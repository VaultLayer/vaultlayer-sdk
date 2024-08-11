import { useCallback } from 'react';
import { useConnectProvider, Vault } from '../context';

export const useVaultProvider = () => {
  const { smartVault, authMethod, vaults, getVaults } = useConnectProvider();

  // TODO
  const addAuthMethod = useCallback(
    async (authMethod: any) => {
      if (!smartVault) {
        throw new Error('smartVault not connected!');
      }
      return true;
    },
    [smartVault]
  );

  return {
    smartVault,
    authMethod,
    vaults,
    getVaults,
    addAuthMethod,
  };
};
