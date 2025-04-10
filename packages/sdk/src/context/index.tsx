import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ConnectModal from '../components/connectModal';
import SignModal from '../components/signModal';
import AuthModal from '../components/authModal';
import { type BaseConnector } from '../connector/base';
import useModalStateValue from '../hooks/useModalStateValue';
import { EventName } from '../types/eventName';
import events from '../utils/eventUtils';
import txConfirm from '../utils/txConfirmUtils';

import { address, type SignerAsync } from 'bitcoinjs-lib';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import type { LitNodeClientConfig, IRelayPKP, LIT_NETWORKS_KEYS } from '@lit-protocol/types';
import { AuthCallbackParams } from '@lit-protocol/types';
import { createSiweMessage, generateAuthSig, LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { LIT_RPC, LIT_ABILITY, AUTH_METHOD_TYPE, PROVIDER_TYPE } from '@lit-protocol/constants';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';

import { createWalletClient, custom, type WalletClient } from 'viem';
import { WalletClientProvider } from '../ethSigner/walletClientProvider';
import { PKPWalletConnect } from '../utils/walletconnect';
import type { AuthMethod } from '../utils/lit';
import {
  authenticateWithEthWallet,
  authenticateWithBtcWallet,
  authenticateWithErc721,
  getPKPs,
  mintPKP,
  BITCOIN_AUTH_METHOD_TYPE,
  BITCOIN_AUTH_LIT_ACTION_IPFS_CID,
  ERC721_AUTH_METHOD_TYPE,
  ERC721_AUTH_LIT_ACTION_IPFS_CID,
} from '../utils/lit';
import type { BTCAddress } from '../utils/bitcoinUtils';
import { getBtcPubkey, getBtcAccounts } from '../utils/bitcoinUtils';

import ModalView from '../components/modalView';

export interface Vault extends IRelayPKP {
  btcPubKey: string;
  authMethod: AuthMethod;
  signer?: any;
}

export interface VaultEthWallet extends PKPEthersWallet {
  options?: any;
}

export interface VaultBtcSigner extends SignerAsync {
  options?: any;
}

interface GlobalState {
  connectorId?: string;
  setConnectorId: (connectorId?: string) => void;
  connector?: BaseConnector;
  connectors: BaseConnector[];
  openConnectModal: () => void;
  closeConnectModal: () => void;
  accounts: string[];
  provider: any;
  disconnect: () => void;
  disconnectVault: () => void;
  getPublicKey: () => Promise<string>;
  signMessageBtc: (message: string) => Promise<string>;
  signMessageEth: (message: string) => Promise<string>;
  authWithWallet: (accounts: string[]) => Promise<AuthMethod | undefined>;
  authWithLSV: (vaultId: string) => Promise<AuthMethod | undefined>;
  authMethod?: AuthMethod;
  smartVault?: Vault;
  vaults?: Vault[];
  getVaults: (authMethod: AuthMethod) => Promise<Vault[] | []>;
  createVault: (authMethod: AuthMethod) => Promise<Vault | undefined>;
  executeVaultTool: (ipfsId: string, params: any) => Promise<any>;
  btcNetwork: 'testnet' | 'livenet';
  btcAccounts: BTCAddress[];
  vaultEthWallet?: VaultEthWallet;
  vaultEthClient?: WalletClient;
  vaultWalletConnect?: any;
  switchBtcNetwork: (network: 'testnet' | 'livenet') => Promise<'testnet' | 'livenet'>;
}

const ConnectContext = createContext<GlobalState>({} as any);

const LIT_NETWORK = (process.env.LIT_NETWORK as LIT_NETWORKS_KEYS) || ('datil' as LIT_NETWORKS_KEYS);

const litClientConfig: LitNodeClientConfig = {
  alertWhenUnauthorized: false,
  litNetwork: LIT_NETWORK,
  debug: false,
};

export const ConnectProvider = ({
  children,
  options,
  connectors,
  autoConnect = true,
}: {
  children: React.ReactNode;
  options: {
    apiKey: string;
    apiUrl: string;
    domain: string;
    showVaultButton: boolean;
    authOnConnect: boolean;
    walletConnect?: any;
    unisatApiKey?: string;
  };
  connectors: BaseConnector[];
  autoConnect?: boolean;
}) => {
  const {
    closeModal: closeConnectModal,
    isModalOpen: connectModalOpen,
    openModal: openConnectModal,
  } = useModalStateValue();

  const { closeModal: closeSignModal, isModalOpen: signModalOpen, openModal: openSignModal } = useModalStateValue();
  const { closeModal: closeAuthModal, isModalOpen: authModalOpen, openModal: openAuthModal } = useModalStateValue();

  const [connectorId, setConnectorId] = useState<string>();
  const [accounts, setAccounts] = useState<string[]>([]);

  const [litNodeClient, setLitNodeClient] = useState<LitNodeClient | undefined>(undefined);
  const [authMethod, setAuthMethod] = useState<AuthMethod | undefined>(undefined);

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [smartVault, setSmartVault] = useState<Vault | undefined>(undefined);
  const [vaultBtcSigner, setVaultBtcSigner] = useState<VaultBtcSigner | undefined>(undefined);
  const [btcNetwork, setBtcNetwork] = useState<'testnet' | 'livenet'>('livenet');
  const [btcAccounts, setBtcAccounts] = useState<BTCAddress[]>([]);
  const [vaultEthWallet, setVaultEthWallet] = useState<VaultEthWallet | undefined>(undefined);
  const [vaultEthClient, setVaultEthClient] = useState<WalletClient | undefined>(undefined);
  const [vaultWalletConnect, setVaultWalletConnect] = useState<any | undefined>(undefined);
  const [showVault, setShowVault] = useState<boolean>(false);

  /**
   * Browser wallet connectors
   */
  useEffect(() => {
    const id = localStorage.getItem('current-connector-id');
    if (autoConnect && id) {
      setConnectorId(id);
    }
  }, [autoConnect]);

  const provider = useMemo(() => {
    if (connectorId) {
      return connectors.find((item) => item.metadata.id === connectorId)?.getProvider();
    }
  }, [connectorId, connectors]);

  const connector = useMemo(() => {
    return connectors.find((item) => item.metadata.id === connectorId);
  }, [connectorId, connectors]);

  useEffect(() => {
    const requestAccounts = async () => {
      if (connector?.isReady()) {
        let getAccounts = await connector.getAccounts();
        console.log('getAccounts start, autoConnect', getAccounts, autoConnect);
        if (getAccounts.length === 0) {
          getAccounts = await connector.requestAccounts();
        }
        setAccounts(getAccounts);
      }
    };
    if (accounts.length === 0 && autoConnect) {
      requestAccounts().catch((e: any) => {
        console.log('get accounts error', e);
        setAccounts([]);
      });
    }
  }, [connector, autoConnect]);

  useEffect(() => {
    const onAccountChange = (accounts: string[]) => {
      setAccounts(accounts);
    };
    connector?.on('accountsChanged', onAccountChange as any);
    return () => {
      connector?.removeListener('accountsChanged', onAccountChange as any);
    };
  }, [connector]);

  const getPublicKey = useCallback(async () => {
    if (!connector) {
      throw new Error('Wallet not connected!');
    }
    const pubKey = await connector.getPublicKey();
    return pubKey;
  }, [connector]);

  // TODO
  const signMessageBtc = useCallback(
    async (message: string) => {
      if (!connector) {
        throw new Error('Wallet not connected!');
      }
      console.log('signMessage context message:', message);

      const signature = await connector.signMessage(message, 'bip322-simple');
      return signature;
    },
    [connector]
  );

  const signMessageEth = useCallback(
    async (message: string) => {
      if (!connector) {
        throw new Error('Wallet not connected!');
      }
      console.log('signMessage context message:', message);

      const signature = await connector.signMessage(message);
      return signature;
    },
    [connector]
  );

  /*
   * Initialize LitNodeClient
   */
  useEffect(() => {
    const litConnect = async () => {
      const client = new LitNodeClient(litClientConfig);
      console.log('Connecting to lit node');
      await client.connect();
      setLitNodeClient(client);
    };

    if (!litNodeClient || !litNodeClient?.ready) {
      litConnect().catch(console.error);
    }
  }, [litNodeClient]);

  // Unmount
  useEffect(() => () => disconnect(), []);

  /**
   * Mint a new PKP for current auth method
   */
  const createVault = useCallback(
    async (authMethod: AuthMethod): Promise<Vault | undefined> => {
      try {
        const newPKP = await mintPKP(authMethod, options.apiUrl);
        console.log('createVault pkp: ', newPKP);
        const newVault = {
          ...newPKP,
        };
        setVaults((prev) => [...prev, newVault]);
        setSmartVault(newVault);
        return newVault;
      } catch (error) {
        console.error('createVault error', error);
        throw new Error('createVault failed');
      }
    },
    [options, setSmartVault, setVaults]
  );

  /**
   * Fetch Vaults (PKPs) tied to given auth method
   */
  const getVaults = useCallback(
    async (authMethod: AuthMethod): Promise<Vault[]> => {
      try {
        // Fetch PKPs tied to given auth method
        const myPKPs = await getPKPs(options.apiUrl, authMethod);
        console.log('myPKPs response: ', myPKPs);
        if (!Array.isArray(myPKPs)) throw new Error(myPKPs);
        if (myPKPs.length > 0) {
          console.log('getVaults myVaults: ', myPKPs);
          setVaults(myPKPs);
          setSmartVault(myPKPs[0]);
          return myPKPs;
        } else {
          const newVault = await createVault(authMethod);
          if (newVault) return [newVault];
          else return [];
        }
      } catch (e: any) {
        console.error('getVaults error', e);
        events.emit(EventName.authResult, `Error getting/creating vault ${e}`);
        return [];
      }
    },
    [options, createVault, setVaults, setSmartVault]
  );

  /*
   * set smartValut
   */
  useEffect(() => {
    if (authMethod && vaults.length == 0) {
      console.log('calling getVaults');
      getVaults(authMethod);
    } else {
      setSmartVault(undefined);
    }
  }, [authMethod, getVaults, setSmartVault]);

  /**
   * Create ETH vaultEthClient
   */
  const createVaultEthClient = useCallback(async () => {
    if (smartVault && litNodeClient && authMethod && !vaultEthWallet) {
      console.log('createVaultEthClient start');
      try {
        let controllerSessionSigs;
        if (authMethod.authMethodType == BITCOIN_AUTH_METHOD_TYPE) {
          controllerSessionSigs = await litNodeClient.getPkpSessionSigs({
            pkpPublicKey: smartVault.publicKey,
            litActionIpfsId: BITCOIN_AUTH_LIT_ACTION_IPFS_CID,
            jsParams: {
              accessToken: authMethod.accessToken,
              network: 'datil',
              pkpTokenId: smartVault.tokenId,
            },
            resourceAbilityRequests: [
              {
                resource: new LitPKPResource('*'),
                ability: LIT_ABILITY.PKPSigning,
              },
              {
                resource: new LitActionResource('*'),
                ability: LIT_ABILITY.LitActionExecution,
              },
            ],
          });
        }
        console.log('createVaultEthClient controllerSessionSigs', controllerSessionSigs);
        const pkpWallet = new PKPEthersWallet({
          controllerSessionSigs,
          litNodeClient,
          pkpPubKey: smartVault.publicKey,
        });
        await pkpWallet?.init();
        console.log('createVaultEthClient pkpWallet:', pkpWallet);
        setVaultEthWallet(pkpWallet);
      } catch (e) {
        setVaultEthWallet(undefined);
        console.error('createVaultEthClient error', e);
      }
    } else {
      setVaultEthWallet(undefined);
    }
  }, [authMethod, litNodeClient, smartVault, vaultEthWallet]);

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
  }, [vaultEthClient, vaultEthWallet]);

  /*
   * Initialize authMethod
   */
  const authWithWallet = useCallback(
    async (accounts: string[]): Promise<AuthMethod | undefined> => {
      try {
        console.log('authWithWallet start');
        console.log('connector type:', connector?.metadata.type);
        events.emit(EventName.startAuth, { address: accounts[0] });
        if (connector?.metadata.type === 'utxo') {
          const result: AuthMethod = await authenticateWithBtcWallet(
            litNodeClient,
            options.domain,
            accounts[0],
            signMessageBtc
          );
          console.log('authWithEthWallet utxo authMethod:', result);
          //TODO: getSessionsigs from PKP
          setAuthMethod(result);
          await getVaults(result);
          await createVaultEthClient();
          return result;
        } else {
          // getSessionsigs from Eth Wallet and add to AuthMethod
          const result: AuthMethod = await authenticateWithEthWallet(
            litNodeClient,
            options.domain,
            accounts[0],
            signMessageEth
          );
          console.log('authWithEthWallet eth authMethod:', result);
          setAuthMethod(result);
          return result;
        }
      } catch (e) {
        setAuthMethod(undefined);
        console.error('authWithEthWallet error', e);
      }
    },
    [options, litNodeClient, connector, setAuthMethod, createVaultEthClient, getVaults, signMessageBtc, signMessageEth]
  );

  /*
   * Initialize authMethod
   */
  const authWithLSV = useCallback(
    async (lsvId: string): Promise<AuthMethod | undefined> => {
      try {
        console.log('authWithNFT start');
        localStorage.removeItem('lit-session-key');
        localStorage.removeItem('lit-wallet-sig');
        events.emit(EventName.startAuth, { address: accounts[0], lsvId: lsvId });
        if (lsvId.startsWith('erc721:')) {
          const result: AuthMethod = await authenticateWithErc721(
            litNodeClient,
            options.domain,
            accounts[0],
            lsvId,
            signMessageEth
          );
          console.log('authWithLSV authenticateWithErc721:', result);
          setAuthMethod(result);
          return result;
        }
      } catch (e) {
        setAuthMethod(undefined);
        console.error('authWithNFT error', e);
      }
    },
    [accounts, litNodeClient, options.domain, signMessageEth, setAuthMethod]
  );

  useEffect(() => {
    if (accounts.length > 0 && litNodeClient?.ready && !authMethod && options.authOnConnect) {
      console.log('calling authWithWallet');
      authWithWallet(accounts);
    }
  }, [accounts, authMethod, authWithWallet, litNodeClient?.ready, options]);

  /**
   * Create ETH Vault WalletConnect
   */
  const connectVaultWalletConnect = useCallback(async () => {
    if (smartVault && vaultEthWallet && !vaultWalletConnect) {
      console.log('connectVaultWalletConnect start');
      try {
        const wcClient = new PKPWalletConnect();
        await wcClient.initWalletConnect(options.walletConnect);
        wcClient.addPKPClient(vaultEthWallet);
        console.log('connectVaultWalletConnect vaultWalletConnect:', wcClient);
        setVaultWalletConnect(wcClient);
      } catch (e) {
        setVaultWalletConnect(undefined);
        console.error('connectVaultWalletConnect error', e);
      }
    } else {
      setVaultWalletConnect(undefined);
    }
  }, [options, smartVault, vaultEthWallet, vaultWalletConnect]);

  useEffect(() => {
    if (smartVault && litNodeClient?.ready && vaultEthWallet && options.walletConnect && !vaultWalletConnect) {
      console.log('calling connectVaultWalletConnect');
      connectVaultWalletConnect();
    }
  }, [vaultEthWallet, options, connectVaultWalletConnect, smartVault, litNodeClient, vaultWalletConnect]);

  useEffect(() => {
    if (vaultEthClient && vaultWalletConnect) {
      console.log('Subscribing to vaultWalletConnect events');

      vaultWalletConnect.on('session_proposal', async (proposal: any) => {
        console.log('vaultWalletConnect received session proposal: ', proposal);
        // Accept session proposal
        await vaultWalletConnect.approveSessionProposal(proposal);
        // Log active sessions
        const sessions: any[] = Object.values(vaultWalletConnect.getActiveSessions());
        for (const session of sessions) {
          const { name, url } = session.peer.metadata;
          console.log(`vaultWalletConnect active session: ${name} (${url})`);
        }
      });

      vaultWalletConnect.on('session_request', async (requestEvent: any) => {
        console.log('vaultWalletConnect received session request: ', requestEvent);
        const { topic, params } = requestEvent;
        const { request } = params;
        const signClient = vaultWalletConnect.getSignClient();
        const requestSession = signClient.session.get(topic);
        const { name, url } = requestSession.peer.metadata;
        // Accept session request
        console.log(`\nvaultWalletConnect Approving ${request.method} request for session ${name} (${url})...\n`);
        events.emit(EventName.personalSign, request);
        events.once(EventName.personalSignResult, async ({ result, error }) => {
          if (result) {
            await vaultWalletConnect.approveSessionRequest(requestEvent);
            console.log(`vaultWalletConnect Check the ${name} dapp to confirm whether the request was approved`);
          } else {
            await vaultWalletConnect.rejectSessionRequest(requestEvent, error);
          }
        });
      });
    }
  }, [vaultWalletConnect, vaultEthClient]);

  // <ModalView />
  useEffect(() => {
    if (smartVault && options.showVaultButton) {
      setShowVault(true);
    }
  }, [smartVault]);

  const switchBtcNetwork = useCallback(
    async (network: 'testnet' | 'livenet') => {
      if (!smartVault) {
        throw new Error('smartVault not connected!');
      }
      setBtcNetwork(network);
      return network;
    },
    [smartVault]
  );

  useEffect(() => {
    if (smartVault) {
      const res = getBtcAccounts(smartVault?.btcPubKey, btcNetwork);
      setBtcAccounts(res);
    }
  }, [smartVault, btcNetwork]);

  /*
   * Excecute Lit Action
   * @param ipfsId - IPFS ID of the Lit Action
   * @param params - Parameters to be passed to the Lit Action
   * @returns - Response from the Lit Action
   * @throws - Error if the Lit Node Client is not ready or if the smart vault is not connected
   */
  const executeVaultTool = useCallback(
    async (ipfsId: string, toolParams: any): Promise<any> => {
      console.log('executeVaultTool authMethod', authMethod);
      if (smartVault && litNodeClient && authMethod && authMethod.sessionSigs) {
        try {
          console.log('executeVaultTool ipfsId', ipfsId);

          const { response } = await litNodeClient.executeJs({
            ipfsId,
            sessionSigs: authMethod.sessionSigs,
            jsParams: {
              params: {
                ...toolParams,
                pkpEthAddress: smartVault.ethAddress,
                authSig: authMethod.accessToken,
              },
            },
          });

          return response;
        } catch (e) {
          console.error('executeVaultTool error', e);
          process.exit(1);
        }
      }
    },
    [litNodeClient, authMethod, smartVault]
  );

  const disconnect = useCallback(() => {
    console.log('disconnecting');
    localStorage.removeItem('current-connector-id');
    txConfirm.reset();
    if (connector) {
      connector.disconnect();
    }
    if (litNodeClient) {
      litNodeClient.disconnect();
    }
    setConnectorId(undefined);
    setAccounts([]);
    setAuthMethod(undefined);
    setVaults([]);
    setSmartVault(undefined);
    setVaultBtcSigner(undefined);
    setVaultEthClient(undefined);
    setVaultEthWallet(undefined);
    setVaultWalletConnect(undefined);
    localStorage.removeItem('lit-session-key');
    localStorage.removeItem('lit-wallet-sig');
  }, [connector]);

  const disconnectVault = useCallback(() => {
    console.log('disconnecting vault');
    setAuthMethod(undefined);
    setVaults([]);
    setSmartVault(undefined);
    setVaultBtcSigner(undefined);
    setVaultEthClient(undefined);
    setVaultEthWallet(undefined);
    setVaultWalletConnect(undefined);
    localStorage.removeItem('lit-session-key');
    localStorage.removeItem('lit-wallet-sig');
  }, []);

  useEffect(() => {
    if (accounts.length === 0) {
      closeConnectModal();
      closeSignModal();
      closeAuthModal();
      if (events.listenerCount(EventName.psbtSignResult) > 0) {
        events.emit(EventName.psbtSignResult, {
          error: {
            code: -32600,
            message: 'Wallet disconnected',
          },
        });
      } else if (events.listenerCount(EventName.personalSignResult) > 0) {
        events.emit(EventName.personalSignResult, {
          error: {
            code: -32600,
            message: 'Wallet disconnected',
          },
        });
      } else if (events.listenerCount(EventName.signTypedDataResult) > 0) {
        events.emit(EventName.signTypedDataResult, {
          error: {
            code: -32600,
            message: 'Wallet disconnected',
          },
        });
      }
    }
  }, [accounts, closeConnectModal, closeSignModal]);

  return (
    <ConnectContext.Provider
      value={{
        connectorId,
        setConnectorId,
        connector,
        connectors,
        openConnectModal,
        closeConnectModal,
        accounts,
        provider,
        disconnect,
        disconnectVault,
        getPublicKey,
        signMessageBtc,
        signMessageEth,
        authWithWallet,
        authWithLSV,
        authMethod,
        smartVault,
        vaults,
        getVaults,
        createVault,
        executeVaultTool,
        btcNetwork,
        btcAccounts,
        switchBtcNetwork,
        vaultEthWallet,
        vaultEthClient,
        vaultWalletConnect,
      }}
    >
      {children}
      <ConnectModal open={connectModalOpen} onClose={closeConnectModal} />
      <SignModal open={signModalOpen} onClose={closeSignModal} onOpen={openSignModal} />
      <AuthModal open={authModalOpen} onClose={closeAuthModal} onOpen={openAuthModal} />
      {showVault && <ModalView />}
    </ConnectContext.Provider>
  );
};

export const useConnectProvider = () => {
  const context = useContext(ConnectContext);
  return context;
};
