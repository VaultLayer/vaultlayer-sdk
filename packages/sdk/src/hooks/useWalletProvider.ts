import { useCallback } from 'react';
import { useConnectProvider } from '../context';

export const useWalletProvider = () => {
  const { connector, provider, accounts, getPublicKey, getNetwork, switchNetwork, sendBitcoin } = useConnectProvider();

  const signMessage = useCallback(
    async (message: string) => {
      if (!connector) {
        throw new Error('Wallet not connected!');
      }
      return await connector.signMessage(message);
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
