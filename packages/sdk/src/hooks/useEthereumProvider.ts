import { intToHex } from '@ethereumjs/util';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { useConnectProvider, Vault } from '../context';
import { WalletClientProvider } from '../ethSigner/walletClientProvider';
import { EventName } from '../types/eventName';
import events, { getPendingSignEventAccount } from '../utils/eventUtils';
import txConfirm from '../utils/txConfirmUtils';

const CALL_CONTRACT_TOOL_IPFS_CID = 'QmbG1tSHHx3LKF86n6TrD1tYGoqBEUBjVdHQoYUTok3CZw';
const COIN_TRANSFER_TOOL_IPFS_CID = 'QmUguju5orFpruE3AWe7HnLX4WAuHcVXmKMD8uQwb73wU8';
const DECRYPT_TOOL_IPFS_CID = 'QmZZvyW4zQe18ogfjFwbFzRsddyukCYBebFr6EoYR9PLgT';

export const useEthereumProvider = () => {
  const { smartVault, authMethod, vaultEthWallet, vaultEthClient, vaultWalletConnect, executeVaultTool } =
    useConnectProvider();
  const [chainId, setChainId] = useState<number>();

  useEffect(() => {
    if (vaultEthWallet) {
      const chainId = vaultEthWallet.chainId as number;
      if (chainId) {
        console.log('vaultEthWallet chainId:', chainId);
        setChainId(chainId);
      }
      const onChangeChange = (id: string) => {
        setChainId(Number(id));
      };
      vaultEthWallet.provider.on('chainChanged', onChangeChange);
      return () => {
        vaultEthWallet.provider.removeListener('chainChanged', onChangeChange);
      };
    }
  }, [vaultEthWallet]);

  const switchEthChain = useCallback(
    async (chainId: number) => {
      if (vaultEthWallet?.provider) {
        vaultEthWallet.setChainId(chainId);
        setChainId(chainId);
      }
    },
    [vaultEthWallet?.provider]
  );

  const getAccounts = useCallback(async () => {
    return [smartVault?.ethAddress];
  }, [smartVault]);

  const pairToWalletConnect = useCallback(
    async (uri: string) => {
      if (vaultWalletConnect) {
        // Pair using the given URI
        return await vaultWalletConnect.pair({ uri: uri });
      }
    },
    [vaultWalletConnect]
  );

  const callContract = useCallback(
    async (txInfo: {
      chain: string;
      chainId: string;
      contractAddress: string;
      functionAbi: string;
      functionName: string;
      functionArgs: any[];
      value?: string;
    }) => {
      if (!smartVault) {
        throw new Error('smartVault not connected!');
      }
      console.log('callContract txInfo:', txInfo);
      const agentToolSig = await executeVaultTool(CALL_CONTRACT_TOOL_IPFS_CID, {
        // Tool-specific parameters
        ...txInfo,
      });
      return agentToolSig;
    },
    [executeVaultTool, smartVault]
  );

  const coinTransfer = useCallback(
    async (txInfo: { chain: string; chainId: string; recipientAddress: string; value?: string }) => {
      if (!smartVault) {
        throw new Error('smartVault not connected!');
      }
      console.log('coinTransfer txInfo:', txInfo);
      const agentToolSig = await executeVaultTool(COIN_TRANSFER_TOOL_IPFS_CID, {
        // Tool-specific parameters
        ...txInfo,
      });
      return agentToolSig;
    },
    [executeVaultTool, smartVault]
  );

  const decryptString = useCallback(
    async (txInfo: { secretPrefix: string; ciphertext: string; dataToEncryptHash: string }) => {
      if (!smartVault) {
        throw new Error('smartVault not connected!');
      }
      console.log('decryptString txInfo:', txInfo);
      const agentToolSig = await executeVaultTool(DECRYPT_TOOL_IPFS_CID, {
        // Tool-specific parameters
        ...txInfo,
      });
      return agentToolSig;
    },
    [executeVaultTool, smartVault]
  );

  return {
    smartVault,
    authMethod,
    getAccounts,
    vaultEthWallet,
    vaultEthClient,
    switchEthChain,
    decryptString,
    callContract,
    coinTransfer,
    chainId,
    pairToWalletConnect,
  };
};
