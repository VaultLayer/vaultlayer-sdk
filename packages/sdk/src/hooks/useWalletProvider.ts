import { useCallback } from 'react';
import { useConnectProvider } from '../context';

export const useWalletProvider = () => {
  const { connector, provider, accounts, getPublicKey } = useConnectProvider();

  const getNetwork = useCallback(async () => {
    if (!connector) {
      throw new Error('Wallet not connected!');
    }
    const network = await connector.getNetwork();
    return network;
  }, [connector]);

  const switchNetwork = useCallback(
    async (network: string) => {
      if (!connector) {
        throw new Error('Wallet not connected!');
      }
      await connector.switchNetwork(network);
    },
    [connector]
  );

  const signMessage = useCallback(
    async (message: string) => {
      if (!connector) {
        throw new Error('Wallet not connected!');
      }
      return await connector.signMessage(message);
    },
    [connector]
  );

  const sendBitcoin = useCallback(
    async (toAddress: string, satoshis: number, options?: { feeRate: number }) => {
      if (!connector) {
        throw new Error('Wallet not connected!');
      }
      const signature = await connector.sendBitcoin(toAddress, satoshis, options);
      return signature;
    },
    [connector]
  );

  const sendInscription = useCallback(
    async (address: string, inscriptionId: string, options?: { feeRate: number }) => {
      if (!connector) {
        throw new Error('Wallet not connected!');
      }
      return await connector.sendInscription(address, inscriptionId, options);
    },
    [connector]
  );

  return {
    connector,
    provider,
    accounts,
    getPublicKey,
    signMessage,
    getNetwork,
    switchNetwork,
    sendBitcoin,
    sendInscription,
  };
};
