'use client';

import {
  ConnectProvider as VaultConnectProvider,
  OKXConnector,
  UnisatConnector,
  XverseConnector,
  EthereumConnector,
} from '@vaultlayer/sdk';

export default function ConnectProvider({ children }: { children: React.ReactNode }) {
  return (
    <VaultConnectProvider
      options={{
        apiKey: 'xxxx' as string,
        showVaultButton: true,
      }}
      connectors={[new UnisatConnector(), new OKXConnector(), new XverseConnector(), new EthereumConnector()]}
    >
      {children}
    </VaultConnectProvider>
  );
}
