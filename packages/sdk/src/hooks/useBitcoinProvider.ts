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

const SIGN_PSBT_TOOL_IPFS_CID = 'QmUsPfTQommhSmfmCWaAB8krAdN3ELdArFn1DqEth2kHY3';

export const useBitcoinProvider = () => {
  const { smartVault, authMethod, vaults, getVaults, executeVaultTool, btcNetwork, btcAccounts, switchBtcNetwork } =
    useConnectProvider();

  /**
   * Signs the given PSBT in hex format.
   * @param psbtHex - The hex string of the unsigned PSBT to sign.
   * @returns A promise that resolves to the signed PSBT.
   */
  const signPsbt = useCallback(
    async (psbt: bitcoin.Psbt, options?: { forceHideConfirmModal?: boolean; details?: any }) => {
      const showConfirmModal = !options?.forceHideConfirmModal && !txConfirm.isNotRemind();

      if (showConfirmModal) {
        if (getPendingSignEventAccount() > 0) {
          throw new Error('Operation failed, there is a transaction being processed');
        }
      }

      if (!showConfirmModal) {
        // sign & push transaction with Vault
        const txId = await executeVaultTool(SIGN_PSBT_TOOL_IPFS_CID, {
          // Tool-specific parameters
          psbtBase64: psbt.toBase64(),
          btcNetwork: btcNetwork,
        });
        console.log('signPsbt txId:', txId);
        return txId;
      }

      const psbtSignArguments = {
        pstb: psbt,
        details: options?.details,
      };
      return new Promise<bitcoin.Psbt>((resolve, reject) => {
        //emit events for SingModal confirm
        events.emit(EventName.psbtSign, psbtSignArguments);
        events.once(EventName.psbtSignResult, async ({ result, error }) => {
          if (result) {
            console.log('Event vaultSignResult received:', result);
            // signTransaction with Vault
            const txId = await executeVaultTool(SIGN_PSBT_TOOL_IPFS_CID, {
              // Tool-specific parameters
              psbtBase64: result.toBase64(),
              btcNetwork: btcNetwork,
            });
            console.log('signPsbt txId:', txId);
            resolve(txId);
          } else {
            reject(error);
          }
        });
      });
    },
    [btcNetwork, executeVaultTool]
  );

  /**
   * Retrieves the network fees.
   * @returns A promise that resolves to the network fees.
   */
  const getNetworkFee = useCallback(
    async (fee: string, bitcoinRpc?: string) => {
      const network = btcNetwork == 'livenet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

      const provider = new BitcoinRPC({
        network,
        bitcoinRpc: bitcoinRpc ? bitcoinRpc : 'mempool',
      });
      const res = await provider.getFeeRate(fee);
      console.log('feeRate:', res);
      return 10;
      return res;
    },
    [btcNetwork]
  );

  /**
   * Retrieves the network fees.
   * @returns A promise that resolves to the network fees.
   */
  const getNetworkFees = useCallback(
    async (bitcoinRpc?: string) => {
      const network = btcNetwork == 'livenet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

      const provider = new BitcoinRPC({
        network,
        bitcoinRpc: bitcoinRpc ? bitcoinRpc : 'mempool',
      });
      const res = await provider.getFeeRates();
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
    async (address: string, bitcoinRpc?: string) => {
      if (smartVault) {
        console.log('getUtxos btcNetwork:', btcNetwork);
        const res = await getAllUtxos(address, btcNetwork, smartVault.btcPubKey, bitcoinRpc ? bitcoinRpc : 'mempool');
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
    async (txHex: string, bitcoinRpc?: string) => {
      const network = btcNetwork == 'livenet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

      const provider = new BitcoinRPC({
        network,
        bitcoinRpc: bitcoinRpc ? bitcoinRpc : 'mempool',
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
    [smartVault, switchBtcNetwork]
  );

  const getNetwork = useCallback(async () => {
    return btcNetwork;
  }, [btcNetwork]);

  const getAccounts = useCallback(async () => {
    return btcAccounts;
  }, [btcAccounts]);

  const sendBitcoin = useCallback(
    async (
      fromAddress: string,
      toAddress: string,
      satoshis: number,
      options: { feeRate?: number; fee?: FeeSpeedType | string; bitcoinRpc?: string; forceHideConfirmModal?: boolean }
    ) => {
      if (!smartVault) {
        throw new Error('The smart vault is not initialized.');
      }

      console.log('sendBitcoin btcNetwork:', btcNetwork);

      const showConfirmModal = !options?.forceHideConfirmModal && !txConfirm.isNotRemind();

      if (showConfirmModal) {
        if (getPendingSignEventAccount() > 0) {
          throw new Error('Operation failed, there is a transaction being processed');
        }
      }
      const bitcoinRpc = options.bitcoinRpc ? options.bitcoinRpc : 'mempool';

      const utxos = await getUtxos(fromAddress, bitcoinRpc);
      console.log('sendBitcoin utxosResponse:', utxos);
      let feeRateBytes = 1;
      if (options.fee) {
        feeRateBytes = await getNetworkFee(options.fee, bitcoinRpc);
      } else if (options.feeRate) {
        feeRateBytes = options.feeRate;
      }

      // 2) prepare transaction
      const { psbt, fee } = prepareTransaction(btcNetwork, utxos, toAddress, satoshis, fromAddress, feeRateBytes);
      console.log('sendBitcoin pstb:', psbt);
      if (!psbt) {
        throw new Error(`Could not prepare Psbt: btcNetwork: ${btcNetwork}`);
      }

      if (!showConfirmModal) {
        const txId = await signPsbt(psbt);
        return txId;
      }

      const psbtSignArguments = {
        pstb: psbt,
        details: {
          toAddress,
          satoshis,
          fee,
          network: btcNetwork,
          total: satoshis + fee,
        },
      };
      return new Promise<string>((resolve, reject) => {
        //emit events for SingModal confirm
        events.emit(EventName.psbtSign, psbtSignArguments);
        events.once(EventName.psbtSignResult, async ({ result, error }) => {
          if (result) {
            console.log('Event vaultSignResult received:', result);
            // signTransaction with Vault
            const txId = await executeVaultTool(SIGN_PSBT_TOOL_IPFS_CID, {
              // Tool-specific parameters
              psbtBase64: result.toBase64(),
              btcNetwork: btcNetwork,
            });
            console.log('signPsbt txId:', txId);
            resolve(txId);
          } else {
            reject(error);
          }
        });
      });
    },
    [btcNetwork, executeVaultTool, getNetworkFee, getUtxos, signPsbt, smartVault]
  );

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
    signPsbt,
    pushTx,
    sendBitcoin,
    getUtxos,
    getNetworkFee,
    getNetworkFees,
  };
};
