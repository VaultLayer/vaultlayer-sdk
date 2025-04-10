import { intToHex } from '@ethereumjs/util';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { useConnectProvider, Vault } from '../context';
import { WalletClientProvider } from '../ethSigner/walletClientProvider';
import { EventName } from '../types/eventName';
import events, { getPendingSignEventAccount } from '../utils/eventUtils';
import txConfirm from '../utils/txConfirmUtils';

//const SIGN_ECDSA_TOOL_IPFS_CID = 'QmbBNaMVzuoWvCMwRBgsm8ok3Egjg7z58BCTM4U36BeT8p';

const CALL_CONTRACT_TOOL_IPFS_CID = 'QmcCxu2GTsVRHNrcwvdeFoyBVsKnRwEHGNxehfABsdPw52';
const COIN_TRANSFER_TOOL_IPFS_CID = 'QmR63yuTd9D5wHN11Wcn2JVJjbnkH5tABpLLUZ8PQC8E9R';

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

  /*const signEcdsa = useCallback(
    async (message: string) => {
      if (!smartVault) {
        throw new Error('smartVault not connected!');
      }
      console.log('signEcdsa message:', message);
      const agentToolSig = await executeVaultTool(SIGN_ECDSA_TOOL_IPFS_CID, {
        // Tool-specific parameters
        message,
      });
      return agentToolSig;
    },
    [executeVaultTool, smartVault]
  );*/

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

  return {
    smartVault,
    authMethod,
    getAccounts,
    vaultEthWallet,
    vaultEthClient,
    switchEthChain,
    //signEcdsa,
    callContract,
    coinTransfer,
    chainId,
    pairToWalletConnect,
  };
};
