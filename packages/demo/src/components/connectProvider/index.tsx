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
        apiUrl: process.env.NEXT_PUBLIC_VAULTLAYER_API_URL as string,
        apiKey: process.env.NEXT_PUBLIC_VAULTLAYER_API_KEY as string,
        domain: 'localhost',
        showVaultButton: true,
        walletConnect: {
          projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
          metadata: {
            name: process.env.NEXT_PUBLIC_WALLETCONNECT_NAME,
            description: process.env.NEXT_PUBLIC_WALLETCONNECT_DESCRIPTION,
            url: process.env.NEXT_PUBLIC_WALLETCONNECT_URL,
            icons: [process.env.NEXT_PUBLIC_WALLETCONNECT_ICON],
          },
        },
      }}
      connectors={[new UnisatConnector(), new OKXConnector(), new XverseConnector(), new EthereumConnector()]}
    >
      {children}
    </VaultConnectProvider>
  );
}
