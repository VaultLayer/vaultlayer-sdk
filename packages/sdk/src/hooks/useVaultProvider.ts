import { useCallback } from 'react';
import { useConnectProvider } from '../context';

export const useVaultProvider = () => {
  const { smartVault, authMethod, vaults, getVaults, authWithWallet, authWithLSV, disconnectVault, executeVaultTool } =
    useConnectProvider();

  return {
    smartVault,
    authMethod,
    vaults,
    getVaults,
    authWithWallet,
    authWithLSV,
    executeVaultTool,
    disconnectVault,
  };
};
