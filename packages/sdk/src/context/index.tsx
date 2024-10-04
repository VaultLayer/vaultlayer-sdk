import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ConnectModal from '../components/connectModal';
import SignModal from '../components/signModal';
import { type BaseConnector } from '../connector/base';
import useModalStateValue from '../hooks/useModalStateValue';
import { EventName } from '../types/eventName';
import events from '../utils/eventUtils';
import { convertSignature, pubKeyToEthAddress, verifySignature, sigToEthAddress } from '../utils/ethereumUtils';
import txConfirm from '../utils/txConfirmUtils';

import type { SignerAsync } from 'bitcoinjs-lib';
import { LitAuthClient } from '@lit-protocol/lit-auth-client';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import type { LitNodeClientConfig, IRelayPKP, LIT_NETWORKS_KEYS } from '@lit-protocol/types';
import { AuthCallbackParams } from '@lit-protocol/types';
import { AuthMethodType } from '@lit-protocol/constants';
import { LitAbility, LitPKPResource, LitActionResource } from '@lit-protocol/auth-helpers';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { WalletClientProvider } from '../ethSigner/walletClientProvider';
import { PKPWalletConnect } from '../utils/walletconnect';
import type { AuthMethod } from '../utils/lit';
import {
  authenticateWithGoogle,
  authenticateWithEthWallet,
  authenticateWithBtcWallet,
  getPKPs,
  mintPKP,
  signWithLitAction,
  BITCOIN_AUTH_METHOD_TYPE,
  BITCOIN_AUTH_LIT_ACTION_IPFS_CID,
} from '../utils/lit';
import type { BTCAddress } from '../utils/bitcoinUtils';
import { getBtcPubkey, getBtcAccounts } from '../utils/bitcoinUtils';

import ModalView from '../components/modalView';

export interface Vault extends IRelayPKP {
  btcPubKey: string;
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
  getPublicKey: () => Promise<string>;
  signMessageBtc: (message: string) => Promise<string>;
  signMessageEth: (message: string) => Promise<string>;
  authMethod?: AuthMethod;
  smartVault?: Vault;
  vaults?: Vault[];
  getVaults: (litAuthClient: LitAuthClient, authMethod: AuthMethod) => Promise<Vault[] | []>;
  createVault: (litAuthClient: LitAuthClient, authMethod: AuthMethod) => Promise<Vault | undefined>;
  btcNetwork: 'testnet' | 'livenet';
  btcAccounts: BTCAddress[];
  vaultBtcSigner?: VaultBtcSigner;
  vaultEthWallet?: VaultEthWallet;
  vaultEthClient?: WalletClient;
  vaultWalletConnect?: any;
  switchBtcNetwork: (network: 'testnet' | 'livenet') => Promise<'testnet' | 'livenet'>;
}

const ConnectContext = createContext<GlobalState>({} as any);

const LIT_NETWORK = (process.env.LIT_NETWORK as LIT_NETWORKS_KEYS) || ('datil-dev' as LIT_NETWORKS_KEYS);
const RELAYER_LIT_API = process.env.LIT_API_KEY || 'test-api-key';

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
    walletConnect?: any;
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

  const [connectorId, setConnectorId] = useState<string>();
  const [accounts, setAccounts] = useState<string[]>([]);

  const [litNodeClient, setLitNodeClient] = useState<LitNodeClient | undefined>(undefined);
  const [litAuthClient, setLitAuthClient] = useState<LitAuthClient | undefined>(undefined);
  const [authMethod, setAuthMethod] = useState<AuthMethod | undefined>(undefined);

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [smartVault, setSmartVault] = useState<Vault | undefined>(undefined);
  const [vaultBtcSigner, setVaultBtcSigner] = useState<VaultBtcSigner | undefined>(undefined);
  const [btcNetwork, setBtcNetwork] = useState<'testnet' | 'livenet'>('testnet');
  const [btcAccounts, setBtcAccounts] = useState<BTCAddress[]>([]);
  const [vaultEthWallet, setVaultEthWallet] = useState<VaultEthWallet | undefined>(undefined);
  const [vaultEthClient, setVaultEthClient] = useState<WalletClient | null>(null);
  const [vaultWalletConnect, setVaultWalletConnect] = useState<any | null>(null);
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
    } else {
      setAccounts([]);
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
      if (connector.metadata.type === 'uxto') {
        const ethSignature = convertSignature(signature, message);
        return ethSignature;
      }
      return signature;
    },
    [connector]
  );

  /*
   * Initialize LitNodeClient and LitAuthClient
   */
  useEffect(() => {
    const litConnect = async () => {
      const client = new LitNodeClient(litClientConfig);
      console.log('Connecting to lit node');
      await client.connect();
      const authClient = new LitAuthClient({
        litRelayConfig: {
          relayApiKey: RELAYER_LIT_API,
        },
        litNodeClient: client,
      });
      setLitNodeClient(client);
      setLitAuthClient(authClient);
    };

    if (!litNodeClient || !litNodeClient?.ready) {
      litConnect().catch(console.error);
    }
  }, [litNodeClient]);

  // Unmount
  useEffect(() => () => disconnect(), []);

  /*
   * Initialize authMethod
   */

  useEffect(() => {
    const authWithEthWallet = async () => {
      try {
        console.log('authWithEthWallet start');
        console.log('connector type:', connector?.metadata.type);
        if (connector?.metadata.type === 'uxto') {
          const result: AuthMethod = await authenticateWithBtcWallet(
            litNodeClient,
            litAuthClient,
            options.domain,
            accounts[0],
            signMessageBtc
          );
          console.log('authWithEthWallet uxto authMethod:', result);
          setAuthMethod(result);
        } else {
          const result: AuthMethod = await authenticateWithEthWallet(
            litNodeClient,
            litAuthClient,
            options.domain,
            accounts[0],
            signMessageEth
          );
          console.log('authWithEthWallet eth authMethod:', result);
          setAuthMethod(result);
        }
      } catch (e) {
        setAuthMethod(undefined);
        console.error('authWithEthWallet error', e);
      }
    };

    if (accounts.length > 0 && litNodeClient?.ready && !authMethod) {
      console.log('calling authWithEthWallet');
      authWithEthWallet().catch(console.error);
    }
  }, [accounts]);

  /**
   * Mint a new PKP for current auth method
   */
  const createVault = useCallback(
    async (litAuthClient: LitAuthClient, authMethod: AuthMethod): Promise<Vault | undefined> => {
      try {
        const newPKP = await mintPKP(litAuthClient, authMethod, options.apiUrl);
        console.log('createVault pkp: ', newPKP);
        const newVault = {
          ...newPKP,
          btcPubKey: getBtcPubkey(newPKP.publicKey),
        };
        setVaults((prev) => [...prev, newVault]);
        setSmartVault(newVault);
        return newVault;
      } catch (e) {
        console.error('createVault error', e);
      }
    },
    [litAuthClient]
  );

  /**
   * Fetch Vaults (PKPs) tied to given auth method
   */
  const getVaults = useCallback(
    async (litAuthClient: LitAuthClient, authMethod: AuthMethod): Promise<Vault[]> => {
      try {
        //TODO const network = ?????
        const testnet = true;
        // Fetch PKPs tied to given auth method
        console.log('getVaults litAuthClient: ', litAuthClient);
        const myPKPs = await getPKPs(options.apiUrl, authMethod);
        if (myPKPs.length > 0) {
          //map
          const myVaults = myPKPs.map((v) => ({
            ...v,
            btcPubKey: getBtcPubkey(v.publicKey),
          }));
          console.log('getVaults myVaults: ', myVaults);
          setVaults(myVaults);
          setSmartVault(myVaults[0]);
          return myVaults;
        } else {
          const newVault = await createVault(litAuthClient, authMethod);
          if (newVault) return [newVault];
          else return [];
        }
      } catch (e) {
        console.error('getVaults error', e);
        return [];
      }
    },
    [litAuthClient, createVault]
  );

  /*
   * set smartValut
   */
  useEffect(() => {
    if (authMethod && litAuthClient && vaults.length == 0) {
      console.log('calling getVaults');
      getVaults(litAuthClient, authMethod);
    } else {
      setSmartVault(undefined);
    }
  }, [litAuthClient, authMethod, getVaults]);

  /**
   * Create ETH vaultEthClient
   */
  const connectVaultEthClient = useCallback(async () => {
    if (smartVault && litNodeClient && authMethod && !vaultEthWallet) {
      console.log('connectVaultEthClient start');
      try {
        let controllerSessionSigs;
        if (authMethod.authMethodType == AuthMethodType.EthWallet) {
          controllerSessionSigs = await litNodeClient.getPkpSessionSigs({
            pkpPublicKey: smartVault.publicKey,
            authMethods: [authMethod as any],
            chain: 'ethereum',
            resourceAbilityRequests: [
              {
                resource: new LitPKPResource('*'),
                ability: LitAbility.PKPSigning,
              },
              {
                resource: new LitActionResource('*'),
                ability: LitAbility.LitActionExecution,
              },
            ],
          });
        } else {
          controllerSessionSigs = await litNodeClient.getPkpSessionSigs({
            pkpPublicKey: smartVault.publicKey,
            litActionIpfsId: BITCOIN_AUTH_LIT_ACTION_IPFS_CID,
            jsParams: {
              accessToken: authMethod.accessToken,
              network: 'datil-dev',
              pkpTokenId: smartVault.tokenId,
            },
            resourceAbilityRequests: [
              {
                resource: new LitPKPResource('*'),
                ability: LitAbility.PKPSigning,
              },
              {
                resource: new LitActionResource('*'),
                ability: LitAbility.LitActionExecution,
              },
            ],
          });
        }
        console.log('connectVaultEthClient controllerSessionSigs', controllerSessionSigs);
        const pkpWallet = new PKPEthersWallet({
          controllerSessionSigs,
          litNodeClient,
          pkpPubKey: smartVault.publicKey,
        });
        await pkpWallet!.init();
        console.log('connectVaultEthClient pkpWallet:', pkpWallet);
        setVaultEthWallet(pkpWallet);
      } catch (e) {
        setVaultEthWallet(undefined);
        console.error('connectVaultEthClient error', e);
      }
    } else {
      setVaultEthWallet(undefined);
    }
  }, [authMethod, litNodeClient, smartVault, vaultEthWallet]);

  useEffect(() => {
    if (smartVault && litNodeClient?.ready && authMethod && !vaultEthWallet) {
      console.log('calling connectVaultEthClient');
      connectVaultEthClient();
    }
  }, [smartVault, connectVaultEthClient]);

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
  }, [smartVault, vaultEthWallet, vaultWalletConnect]);

  useEffect(() => {
    if (smartVault && litNodeClient?.ready && vaultEthWallet && options.walletConnect && !vaultWalletConnect) {
      console.log('calling connectVaultWalletConnect');
      connectVaultWalletConnect();
    }
  }, [vaultEthWallet, options, connectVaultWalletConnect]);

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
   * Create BTC vaultBtcSigner
   */
  useEffect(() => {
    if (smartVault && litNodeClient?.ready && !vaultBtcSigner) {
      console.log('creating vaultBtcSigner');
      const signer = {
        publicKey: Buffer.from(smartVault?.btcPubKey, 'hex'),
        sign: (hash: Buffer, lowerR: boolean): Promise<Buffer> => {
          console.log('calling vaultBtcSigner signWithLitAction with hash', hash);
          return new Promise((resolve, rejects) => {
            console.log('calling vaultBtcSigner signWithLitAction with authMethod', authMethod);
            signWithLitAction(litNodeClient, litAuthClient, authMethod, hash, smartVault.publicKey)
              .then(function (sig) {
                const signatureBuf = Buffer.from((sig as any).r + (sig as any).s, 'hex');
                resolve(signatureBuf);
              })
              .catch(function (reason) {
                rejects(reason);
              });
          });
        },
      };
      console.log('vaultBtcSigner:', signer);
      setVaultBtcSigner(signer);
    }
  }, [smartVault]);

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
    setLitNodeClient(undefined);
    setLitAuthClient(undefined);
    setAuthMethod(undefined);
    setVaults([]);
    setSmartVault(undefined);
    setAccounts([]);
  }, [connector]);

  useEffect(() => {
    if (accounts.length === 0) {
      closeConnectModal();
      closeSignModal();
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
        getPublicKey,
        signMessageBtc,
        signMessageEth,
        authMethod,
        smartVault,
        vaults,
        getVaults,
        createVault,
        vaultBtcSigner,
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
      {showVault && <ModalView />}
    </ConnectContext.Provider>
  );
};

export const useConnectProvider = () => {
  const context = useContext(ConnectContext);
  return context;
};
