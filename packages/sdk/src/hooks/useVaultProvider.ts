import { intToHex } from '@ethereumjs/util';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createWalletClient, custom, type PublicClient } from 'viem';
import { useConnectProvider, Vault } from '../context';
import { WalletClientProvider } from '../ethSigner/walletClientProvider';
import { EventName } from '../types/eventName';
import events, { getPendingSignEventAccount } from '../utils/eventUtils';
import txConfirm from '../utils/txConfirmUtils';

import * as bitcoin from "bitcoinjs-lib";
import { prepareTransaction, validator, broadcastBtcTransaction } from '../utils/bitcoinUtils';
import { toOutputScript } from "bitcoinjs-lib/src/address";
import { networks } from 'ecpair';
import { buildStakeTransaction, StakeParams, buildRedeemTransaction, RedeemParams } from "../lib/coredao-staking/transaction";
import { RedeemScriptType } from "../lib/coredao-staking/constant";

import axios from 'axios';


export const useVaultProvider = () => {
  const { smartVault, authMethod, vaults, getVaults, vaultBtcSigner, vaultEthWallet } = useConnectProvider();
  const [chainId, setChainId] = useState<number>();
  const [network, setNetwork] = useState<number>();
  const [testnet, setTestnet] = useState<boolean>(true);
  const [vaultEthClient, setVaultEthClient] = useState<any | null>(null);

  const sendBitcoin = useCallback(
    async (toAddress: string, satoshis: number, options?: { feeRate: number, forceHideConfirmModal?: boolean }) => {
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
      const utxosResponse = await axios.get(`http://localhost:3000/api/v1/portfolio/utxos?address=${smartVault.btcAddresses[0].address}`, {
        headers: {
          Accept: "application/json"
        }
      });
      console.log("utxosResponse:", utxosResponse.data);

      const utxos = utxosResponse?.data.utxos?.map((utxo: { txid: any; vout: any; satoshi: any; address: string; }) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.satoshi,
        witnessUtxo: {
          script: toOutputScript(
            utxo.address,
            testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin,
          ),
          value: utxo.satoshi
        }
      }));

      // 2) prepare transaction
      const { psbt, fee } = prepareTransaction(utxos, toAddress, satoshis, smartVault.btcAddresses[0].address, options?.feeRate ? options?.feeRate: 0);
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
          network: testnet ? 'Mainnet' : 'Testnet',
          total: satoshis + fee,
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
    async (validatorAddress: string, amount: string, lockTime: number, options?: { feeRate: number, forceHideConfirmModal?: boolean }) => {
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
            testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin,
          ),
          value: utxo.satoshi
        }
      }));
      */

      // 2) prepare transaction
      const stakingOptions = {
        witness: false,
        type: RedeemScriptType.PUBLIC_KEY_HASH_SCRIPT,
        coreNetwork: "testnet",
        bitcoinNetwork: "testnet",
        bitcoinRpc: "mempool",
        fee: "avg",  // TODO options.feeRate
      }

      const { psbt, fee, scriptAddress, redeemScript } = await buildStakeTransaction({
        ...stakingOptions,
        lockTime: Number(lockTime),
        account: smartVault.btcAddresses[0].address,
        amount,
        validatorAddress,
        rewardAddress: smartVault.ethAddress,
        publicKey: Buffer.from(smartVault.btcAddresses[0].publicKey, "hex"),
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
          network: testnet ? 'Mainnet' : 'Testnet',
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

      const res = await broadcastBtcTransaction(txHex, testnet);
      console.log('pushTx broadcast res:', res);
      return res;

    },
    [testnet]
  );

  useEffect(() => {
    if (vaultEthWallet) {
      const chainId = (vaultEthWallet.provider as any).chainId as number;
      console.log('svaultEthWallet chainId:', chainId);
      setNetwork(chainId);

      const onChangeChange = (id: string) => {
        setNetwork(Number(id));
      };
      vaultEthWallet.provider.on('chainChanged', onChangeChange);
      return () => {
        vaultEthWallet.provider.removeListener('chainChanged', onChangeChange);
      };
    }
  }, [vaultEthWallet]);

  const switchNetwork = useCallback(
    async (chainId: number) => {
      if (vaultEthWallet?.provider) {
        await vaultEthWallet.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [
            {
              chainId: intToHex(chainId),
            },
          ],
        });
      }
    },
    [vaultEthWallet?.provider]
  );


  useEffect(() => {
    const vaultEthWallets = async () => {
      const walletClient = createWalletClient({
        transport: custom(new WalletClientProvider(vaultEthWallet.provider)),
      });
      console.log('walletClient:', walletClient);
      setVaultEthClient(walletClient)
    }

    if (vaultEthWallet?.provider && !vaultEthClient) {
      vaultEthWallets()
        .catch(console.error);
    }
  },
    [vaultEthWallet]
  );

  return {
    smartVault,
    authMethod,
    vaults,
    getVaults,
    signPsbt,
    pushBitcoinTx,
    sendBitcoin,
    stakeBitcoin,
    vaultBtcSigner,
    vaultEthWallet,
    vaultEthClient,
    switchNetwork,
    network,
    chainId
  };
};
