import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnectProvider, Vault } from '../context';
import { EventName } from '../types/eventName';
import events, { getPendingSignEventAccount } from '../utils/eventUtils';
import txConfirm from '../utils/txConfirmUtils';

import * as bitcoin from 'bitcoinjs-lib';
import { prepareTransaction, getAllUtxos, validator } from '../utils/bitcoinUtils';
import { toOutputScript } from 'bitcoinjs-lib/src/address';
import type { FeeSpeedType } from '../utils/bitcoinRpc';
import { BitcoinRPC } from '../utils/bitcoinRpc';

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

      const utxos = await getUtxos(fromAddress);
      console.log('sendBitcoin utxosResponse:', utxos);

      const feeRate = await getNetworkFees(options.fee);

      // 2) prepare transaction
      const { psbt, fee } = prepareTransaction(utxos, toAddress, satoshis, fromAddress, feeRate ? feeRate : 0);
      console.log('sendBitcoin pstb:', psbt);
      if (!psbt) {
        throw new Error('Could not prepare Psbt');
      }

      if (!showConfirmModal) {
        const txHex = await signPsbt(psbt, { autoFinalized: true });
        return await pushTx(txHex);
      }

      const psbtSignArguments = {
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
        events.emit(EventName.psbtSign, psbtSignArguments);
        events.once(EventName.psbtSignResult, async ({ result, error }) => {
          if (result) {
            console.log('Event vaultSignResult received:', result);
            await result.signAllInputsAsync(vaultBtcSigner);
            result.validateSignaturesOfAllInputs(validator);
            console.log('signPsbt signed pstb:', result);
            result.finalizeAllInputs();
            console.log('signPsbt Tx:', result.extractTransaction().toHex());
            const txHex = result.extractTransaction().toHex();
            const txReceipt = await pushTx(txHex);
            resolve(txReceipt);
          } else {
            reject(error);
          }
        });
      });
    },
    [smartVault, vaultBtcSigner]
  );

  /**
   * Signs a message
   * @param message - The message to sign.
   * @returns A promise that resolves to the signed message.
   */
  //TODO: https://github.com/bitcoinjs/bitcoinjs-message/blob/master/index.js
  // const signMessage = useCallback()

  /**
   * Signs the given PSBT in hex format.
   * @param psbtHex - The hex string of the unsigned PSBT to sign.
   * @returns A promise that resolves to the hex string of the signed PSBT.
   */
  const signPsbt = useCallback(
    async (psbt: bitcoin.Psbt, options?: { autoFinalized: boolean; forceHideConfirmModal?: boolean }) => {
      if (!vaultBtcSigner) {
        throw new Error('The vault signer is not initialized.');
      }

      const showConfirmModal = !options?.forceHideConfirmModal && !txConfirm.isNotRemind();

      if (showConfirmModal) {
        if (getPendingSignEventAccount() > 0) {
          throw new Error('Operation failed, there is a transaction being processed');
        }
      }

      if (!showConfirmModal) {
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
      }

      const psbtSignArguments = {
        pstb: psbt,
      };
      return new Promise<string>((resolve, reject) => {
        //emit events for SingModal confirm
        events.emit(EventName.psbtSign, psbtSignArguments);
        events.once(EventName.psbtSignResult, async ({ result, error }) => {
          if (result) {
            console.log('Event vaultSignResult received:', result);
            await result.signAllInputsAsync(vaultBtcSigner);
            result.validateSignaturesOfAllInputs(validator);
            console.log('signPsbt signed pstb:', result);

            if (options?.autoFinalized) {
              result.finalizeAllInputs();
            }
            console.log('signPsbt Tx:', result.extractTransaction().toHex());
            resolve(result.extractTransaction().toHex());
          } else {
            reject(error);
          }
        });
      });
    },
    [vaultBtcSigner]
  );

  /**
   * Retrieves the network fees.
   * @returns A promise that resolves to the network fees.
   */
  const getNetworkFees = useCallback(
    async (fee: string) => {
      const network = btcNetwork == 'livenet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

      const provider = new BitcoinRPC({
        network,
        bitcoinRpc: 'mempool',
      });
      const res = await provider.getFeeRate(fee);
      console.log('feeRate:', res);
      return res;
    },
    [btcNetwork]
  );

  /**
   * Retrieves the unspent transaction outputs (UTXOs) for a given address and amount.
   * If the amount is provided, it will return UTXOs that cover the specified amount.
   * If the amount is not provided, it will return all available UTXOs for the address.
   *
   * @param address - The address to retrieve UTXOs for.
   * @param amount - Optional amount of funds required.
   * @returns A promise that resolves to an array of UTXOs.
   */
  const getUtxos = useCallback(
    async (address: string, amount?: number) => {
      if (smartVault) {
        const res = await getAllUtxos(address, btcNetwork, smartVault.btcPubKey, 'mempool');
        console.log('getUtxos res:', res);
        return res;
      } else {
        return [];
      }
    },
    [btcNetwork, smartVault]
  );

  /**
   * Pushes a transaction to the network.
   * @param txHex - The hexadecimal representation of the transaction.
   * @returns A promise that resolves to a string representing the transaction ID.
   */
  const pushTx = useCallback(
    async (txHex: string) => {
      const network = btcNetwork == 'livenet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

      const provider = new BitcoinRPC({
        network,
        bitcoinRpc: 'mempool',
      });
      const res = await provider.broadcast(txHex);
      console.log('pushTx broadcast res:', res);
      return res;
    },
    [btcNetwork]
  );

  const switchNetwork = useCallback(
    async (network: 'testnet' | 'livenet', options?: { forceHideConfirmModal?: boolean }) => {
      if (smartVault) {
        const showConfirmModal = !options?.forceHideConfirmModal && !txConfirm.isNotRemind();
        if (showConfirmModal) {
          if (getPendingSignEventAccount() > 0) {
            throw new Error('Operation failed, there is a transaction being processed');
          }
        }

        if (!showConfirmModal) {
          switchBtcNetwork(network);
          return;
        }

        const switchNetworkArguments = {
          network,
        };

        return new Promise<string>((resolve, reject) => {
          //emit events for SingModal confirm
          events.emit(EventName.switchNetwork, switchNetworkArguments);
          events.once(EventName.switchNetworkResult, async ({ result, error }) => {
            if (result) {
              console.log('Event switchNetwork received:', result);
              switchBtcNetwork(network);
              resolve('Switched to: ' + network);
            } else {
              reject(error);
            }
          });
        });
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
    pushTx,
    sendBitcoin,
    getUtxos,
    getNetworkFees,
  };
};
