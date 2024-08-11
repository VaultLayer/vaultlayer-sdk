import { intToHex } from '@ethereumjs/util';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { useConnectProvider, Vault } from '../context';
import { WalletClientProvider } from '../ethSigner/walletClientProvider';
import { EventName } from '../types/eventName';
import events, { getPendingSignEventAccount } from '../utils/eventUtils';
import txConfirm from '../utils/txConfirmUtils';

export const useEthereumProvider = () => {
  const { smartVault, authMethod, vaultEthWallet } = useConnectProvider();
  const [chainId, setChainId] = useState<number>();

  const [vaultEthClient, setVaultEthClient] = useState<WalletClient | null>(null);

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

  useEffect(() => {
    const vaultEthWallets = async () => {
      if (vaultEthWallet && vaultEthWallet?.provider) {
        const walletClient = createWalletClient({
          transport: custom(new WalletClientProvider(vaultEthWallet?.provider as any)),
        });
        console.log('walletClient:', walletClient);
        setVaultEthClient(walletClient);
      }
    };

    if (vaultEthWallet?.provider && !vaultEthClient) {
      vaultEthWallets().catch(console.error);
    }
  }, [vaultEthWallet]);

  return {
    smartVault,
    authMethod,
    vaultEthWallet,
    vaultEthClient,
    switchEthChain,
    chainId,
  };
};
