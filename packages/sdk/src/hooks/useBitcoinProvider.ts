import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnectProvider, Vault } from '../context';
import { EventName } from '../types/eventName';
import events, { getPendingSignEventAccount } from '../utils/eventUtils';
import txConfirm from '../utils/txConfirmUtils';

import * as bitcoin from 'bitcoinjs-lib';
import { prepareTransaction, getUtxos, validator, broadcastBtcTransaction } from '../utils/bitcoinUtils';
import { toOutputScript } from 'bitcoinjs-lib/src/address';
import { networks } from 'ecpair';
import { Provider } from '../lib/coredao-staking/provider';
import {
  buildStakeTransaction,
  StakeParams,
  buildRedeemTransaction,
  RedeemParams,
} from '../lib/coredao-staking/transaction';
import type { FeeSpeedType } from '../lib/coredao-staking/constant';
import { RedeemScriptType } from '../lib/coredao-staking/constant';

import axios from 'axios';

export const useBitcoinProvider = () => {
  const { smartVault, authMethod, vaults, getVaults, vaultBtcSigner, btcNetwork, btcAccounts, switchBtcNetwork } =
    useConnectProvider();

  const sendBitcoin = useCallback(
    async (
      fromAddress: string,
      toAddress: string,
      satoshis: number,
      options: { fee: FeeSpeedType | string; bitcoinRpc: string; forceHideConfirmModal?: boolean }
    ) => {
      if (!smartVault) {
        throw new Error('The smart vault is not initialized.');
      }
      if (!vaultBtcSigner) {
        throw new Error('The vault signer is not initialized.');
      }

      const showConfirmModal = !options?.forceHideConfirmModal && !txConfirm.isNotRemind();

      if (showConfirmModal) {
        if (getPendingSignEventAccount() > 0) {
          throw new Error('Operation failed, there is a transaction being processed');
        }
      }

      //call our API /utxos
      // smartVault.btcAddresses[0].address
      /*
      const utxosResponse = await axios.get(`http://localhost:3001/api/v1/portfolio/utxos?address=${fromAddress}`, {
        headers: {
          Accept: 'application/json',
        },
      });
      console.log('utxosResponse:', utxosResponse.data);

      const utxos = utxosResponse?.data.utxos?.map((utxo: { txid: any; vout: any; satoshi: any; address: string }) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.satoshi,
        witnessUtxo: {
          script: toOutputScript(
            utxo.address,
            btcNetwork === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
          ),
          value: utxo.satoshi,
        },
      }));
      */

      const utxos = await getUtxos(fromAddress, btcNetwork, smartVault.btcPubKey, options.bitcoinRpc);
      console.log('sendBitcoin utxosResponse:', utxos);

      const network = btcNetwork == 'livenet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

      const provider = new Provider({
        network,
        bitcoinRpc: options.bitcoinRpc,
      });
      const feeRate = await provider.getFeeRate(options.fee);
      console.log('sendBitcoin feeRate:', feeRate);

      // 2) prepare transaction
      const { psbt, fee } = prepareTransaction(utxos, toAddress, satoshis, fromAddress, feeRate ? feeRate : 0);
      console.log('sendBitcoin pstb:', psbt);
      if (!psbt) {
        throw new Error('Could not prepare Psbt');
      }

      if (!showConfirmModal) {
        const txHex = await signPsbt(psbt, { autoFinalized: true });
        return await pushBitcoinTx(txHex);
      }

      const vaultSignArguments = {
        pstb: psbt,
        details: {
          toAddress,
          satoshis,
          fee,
          network: btcNetwork,
          total: satoshis + fee,
          moreInfo: {
            title: 'Inputs & Outputs',
            content: `Inputs: ${psbt.txInputs.length}, Outputs: ${psbt.txOutputs.length},`,
          },
        },
      };
      return new Promise<string>((resolve, reject) => {
        //emit events for SingModal confirm
        events.emit(EventName.vaultSign, vaultSignArguments);
        events.once(EventName.vaultSignResult, async ({ result, error }) => {
          if (result) {
            console.log('Event vaultSignResult received:', result);
            const txHex = await signPsbt(result, { autoFinalized: true });
            const txReceipt = await pushBitcoinTx(txHex);
            resolve(txReceipt);
          } else {
            reject(error);
          }
        });
      });
    },
    [smartVault, vaultBtcSigner]
  );

  const stakeBitcoin = useCallback(
    async (
      fromAddress: string,
      validatorAddress: string,
      amount: string,
      lockTime: number,
      options?: { feeRate: number; forceHideConfirmModal?: boolean }
    ) => {
      if (!smartVault) {
        throw new Error('The smart vault is not initialized.');
      }
      if (!vaultBtcSigner) {
        throw new Error('The vault signer is not initialized.');
      }

      const showConfirmModal = !options?.forceHideConfirmModal && !txConfirm.isNotRemind();

      if (showConfirmModal) {
        if (getPendingSignEventAccount() > 0) {
          throw new Error('Operation failed, there is a transaction being processed');
        }
      }

      //call our API /utxos
      // smartVault.btcAddresses[0].address
      /*
      const utxosResponse = await axios.get(`http://localhost:3000/api/v1/portfolio/utxos?address=${smartVault.btcAddresses[0].address}`, {
        headers: {
          Accept: "application/json"
        }
      });
      console.log("utxosResponse:", utxosResponse.data);

      const utxos = utxosResponse?.data.utxos?.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.satoshi,
        witnessUtxo: {
          script: toOutputScript(
            utxo.address,
            vaultBtcNetwork === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin,
          ),
          value: utxo.satoshi
        }
      }));
      */

      // 2) prepare transaction
      const stakingOptions = {
        witness: false,
        type: RedeemScriptType.PUBLIC_KEY_HASH_SCRIPT,
        coreNetwork: 'testnet',
        bitcoinNetwork: 'testnet',
        bitcoinRpc: 'mempool',
        fee: 'avg', // TODO options.feeRate
      };

      const { psbt, fee, scriptAddress, redeemScript } = await buildStakeTransaction({
        ...stakingOptions,
        lockTime: Number(lockTime),
        account: fromAddress,
        amount,
        validatorAddress,
        rewardAddress: smartVault.ethAddress,
        publicKey: Buffer.from(smartVault.btcPubKey, 'hex'),
      });

      console.log('stakeBitcoin pstb:', psbt);
      if (!psbt) {
        throw new Error('Could not prepare Psbt');
      }

      if (!showConfirmModal) {
        const txHex = await signPsbt(psbt, { autoFinalized: true });
        return await pushBitcoinTx(txHex);
      }

      const vaultSignArguments = {
        pstb: psbt,
        details: {
          toAddress: validatorAddress,
          satoshis: parseInt(amount),
          fee,
          network: btcNetwork,
          total: amount + fee,
          moreInfo: {
            title: 'Inputs & Outputs',
            content: `Inputs: ${psbt.txInputs.length}, Outputs: ${psbt.txOutputs.length},`,
          },
        },
      };

      return new Promise<string>((resolve, reject) => {
        //emit events for SingModal confirm
        events.emit(EventName.vaultSign, vaultSignArguments);
        events.once(EventName.vaultSignResult, async ({ result, error }) => {
          if (result) {
            console.log('Event vaultSignResult received:', result);
            const txHex = await signPsbt(result, { autoFinalized: true });
            const txReceipt = await pushBitcoinTx(txHex);
            resolve(txReceipt);
          } else {
            reject(error);
          }
        });
      });
    },
    [smartVault, vaultBtcSigner]
  );

  //TODO: https://github.com/bitcoinjs/bitcoinjs-message/blob/master/index.js
  // const signMessage = useCallback()

  const signPsbt = useCallback(
    async (psbt: bitcoin.Psbt, options?: { autoFinalized: boolean }) => {
      if (!vaultBtcSigner) {
        throw new Error('The vault signer is not initialized.');
      }

      // signTransaction with Vault
      console.log('signPsbt vaultBtcSigner:', vaultBtcSigner);
      await psbt.signAllInputsAsync(vaultBtcSigner);
      psbt.validateSignaturesOfAllInputs(validator);
      console.log('signPsbt signed pstb:', psbt);

      if (options?.autoFinalized) {
        psbt.finalizeAllInputs();
      }
      console.log('signPsbt Tx:', psbt.extractTransaction().toHex());
      return psbt.extractTransaction().toHex();
    },
    [vaultBtcSigner]
  );

  const pushBitcoinTx = useCallback(
    async (txHex: string) => {
      const res = await broadcastBtcTransaction(txHex, btcNetwork === 'testnet');
      console.log('pushTx broadcast res:', res);
      return res;
    },
    [btcNetwork]
  );

  const switchNetwork = useCallback(
    async (network: 'testnet' | 'livenet', options?: { forceHideConfirmModal?: boolean }) => {
      if (smartVault) {
        //TODO
        //const showConfirmModal = !options?.forceHideConfirmModal && !txConfirm.isNotRemind();
        const showConfirmModal = false;
        if (showConfirmModal) {
          if (getPendingSignEventAccount() > 0) {
            throw new Error('Operation failed, there is a transaction being processed');
          }
        }

        if (!showConfirmModal) {
          switchBtcNetwork(network);
          return;
        }
        /*
        const vaultSignArguments = {
          pstb: psbt,
          details: {
            toAddress: validatorAddress,
            satoshis: parseInt(amount),
            fee,
            network: vaultBtcNetwork,
            total: amount + fee,
            moreInfo: {
              title: 'Inputs & Outputs',
              content: `Inputs: ${psbt.txInputs.length}, Outputs: ${psbt.txOutputs.length},`
            }
          }
        }
  
        return new Promise<string>((resolve, reject) => {
          //emit events for SingModal confirm
          events.emit(EventName.vaultSign, vaultSignArguments);
          events.once(EventName.vaultSignResult, async ({ result, error }) => {
            if (result) {
              console.log('Event vaultSignResult received:', result);
              setVaultBtcNetwork(network);
              resolve('Switched to: '+network);
            } else {
              reject(error);
            }
          });
        });
        */
      }
    },
    [smartVault]
  );

  const getNetwork = useCallback(async () => {
    return btcNetwork;
  }, [btcNetwork]);

  const getAccounts = useCallback(async () => {
    return btcAccounts;
  }, [btcAccounts]);

  return {
    smartVault,
    authMethod,
    vaults,
    getVaults,
    btcNetwork,
    getNetwork,
    switchNetwork,
    btcAccounts,
    getAccounts,
    vaultBtcSigner,
    signPsbt,
    pushBitcoinTx,
    sendBitcoin,
    stakeBitcoin,
  };
};
