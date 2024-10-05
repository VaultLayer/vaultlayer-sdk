import { intToHex } from '@ethereumjs/util';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { useConnectProvider, Vault } from '../context';
import { WalletClientProvider } from '../ethSigner/walletClientProvider';
import { EventName } from '../types/eventName';
import events, { getPendingSignEventAccount } from '../utils/eventUtils';
import txConfirm from '../utils/txConfirmUtils';

export const useEthereumProvider = () => {
  const { smartVault, authMethod, vaultEthWallet, vaultEthClient, vaultWalletConnect } = useConnectProvider();
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

  return {
    smartVault,
    authMethod,
    getAccounts,
    vaultEthWallet,
    vaultEthClient,
    switchEthChain,
    chainId,
    pairToWalletConnect,
  };
};
