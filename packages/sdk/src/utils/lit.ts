import type { LitNodeClient } from '@lit-protocol/lit-node-client';
import type { GetSessionSigsProps, IRelayPKP, SessionSigs, AuthSig } from '@lit-protocol/types';
import { AuthCallbackParams } from '@lit-protocol/types';
import { createSiweMessage, LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { LIT_RPC, LIT_ABILITY, AUTH_METHOD_TYPE, PROVIDER_TYPE } from '@lit-protocol/constants';
import { createSiweMessageWithRecaps } from '@lit-protocol/auth-helpers';
import { ethers, utils } from 'ethers';
import { getSchnorrHash } from './bitcoinUtils';

export const BITCOIN_AUTH_METHOD_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('BITCOIN_BIP322_v0_3'));
export const BITCOIN_AUTH_LIT_ACTION_IPFS_CID = 'QmS1CJZrZ1HNgmwiGN85Lscov3ybbZ77yVLCs4UsAcmPjJ';
export const ERC721_AUTH_METHOD_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('ERC721_V0_39'));
export const ERC721_AUTH_LIT_ACTION_IPFS_CID = 'QmTwiw4cePFKV6rCMhxoa4cHf1cJDyxdG4f2Kxuuk4w118';

export interface AuthMethod {
  authMethodType: number | string;
  accessToken?: string;
  sessionSigs?: SessionSigs;
}

export interface Vault extends IRelayPKP {
  btcPubKey: string;
  authMethod: AuthMethod;
  signer?: any;
}

/**
 * Get auth method object by signing a message with an Ethereum wallet
 */
export async function authenticateWithEthWallet(
  litNodeClient: LitNodeClient | undefined,
  domain: string,
  address: string,
  signMessage: (message: string) => Promise<string>
): Promise<AuthMethod> {
  if (!litNodeClient) {
    throw new Error('No litNodeClient');
  }
  const generateAuthSig = async ({
    toSign,
    address,
    algo,
  }: {
    toSign: string;
    address: string;
    algo?: 'ed25519';
  }): Promise<AuthSig> => {
    const signature = await signMessage(toSign);

    return {
      sig: signature,
      derivedVia: 'web3.eth.personal.sign',
      signedMessage: toSign,
      address: address,
      ...(algo && { algo }),
    };
  };

  const sessionSigs = await litNodeClient.getSessionSigs({
    chain: 'ethereum',
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    /*capabilityAuthSigs:
      capacityDelegationAuthSig !== undefined
        ? [capacityDelegationAuthSig]
        : undefined,*/
    resourceAbilityRequests: [
      {
        resource: new LitActionResource('*'),
        ability: LIT_ABILITY.LitActionExecution,
      },
      {
        resource: new LitPKPResource('*'),
        ability: LIT_ABILITY.PKPSigning,
      },
    ],
    authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
      const toSign = await createSiweMessage({
        statement: 'Sign in to VaultLayer.xyz',
        domain,
        uri,
        expiration,
        resources: resourceAbilityRequests,
        walletAddress: address,
        nonce: await litNodeClient.getLatestBlockhash(),
        litNodeClient: litNodeClient,
      });

      return await generateAuthSig({
        toSign,
        address,
      });
    },
  });

  const authMethod = {
    authMethodType: AUTH_METHOD_TYPE.EthWallet,
    accessToken: '',
    sessionSigs,
  };

  return authMethod;
}

export async function authenticateWithErc721(
  litNodeClient: LitNodeClient | undefined,
  domain: string,
  address: string,
  lsvId: string,
  signMessage: (message: string) => Promise<string>
): Promise<AuthMethod> {
  if (!litNodeClient) {
    throw new Error('No litNodeClient');
  }
  const generateAuthSig = async ({
    toSign,
    address,
    algo,
  }: {
    toSign: string;
    address: string;
    algo?: 'ed25519';
  }): Promise<AuthSig> => {
    const signature = await signMessage(toSign);

    return {
      sig: signature,
      derivedVia: 'web3.eth.personal.sign',
      signedMessage: toSign,
      address: address,
      ...(algo && { algo }),
    };
  };

  const sessionSigs = await litNodeClient.getSessionSigs({
    chain: 'ethereum',
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    /*capabilityAuthSigs:
      capacityDelegationAuthSig !== undefined
        ? [capacityDelegationAuthSig]
        : undefined,*/
    resourceAbilityRequests: [
      {
        resource: new LitActionResource('*'),
        ability: LIT_ABILITY.LitActionExecution,
      },
      {
        resource: new LitPKPResource('*'),
        ability: LIT_ABILITY.PKPSigning,
      },
    ],
    authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
      const toSign = await createSiweMessage({
        statement: `Sign-in to VaultLayer.xyz - Smart Vault with Id: ${lsvId}`,
        domain,
        uri,
        expiration,
        resources: resourceAbilityRequests,
        walletAddress: address,
        nonce: await litNodeClient.getLatestBlockhash(),
        litNodeClient: litNodeClient,
      });

      return await generateAuthSig({
        toSign,
        address,
      });
    },
  });

  const authMethod = {
    authMethodType: AUTH_METHOD_TYPE.EthWallet,
    accessToken: JSON.stringify(
      lsvId
        ? {
            authMethodType: ERC721_AUTH_METHOD_TYPE,
            address: address,
            chain: lsvId.split(':')[1],
            contractAddress: lsvId.split(':')[2],
            erc721TokenId: lsvId.split(':')[3],
          }
        : {}
    ),
    sessionSigs,
  };

  return authMethod;
}

/**
 * Get auth method object by signing a message with a Bitcoin wallet
 */
export async function authenticateWithBtcWallet(
  litNodeClient: LitNodeClient | undefined,
  domain: string,
  address: string,
  signMessage: (message: string) => Promise<string>
): Promise<AuthMethod> {
  if (!litNodeClient) {
    throw new Error('No litNodeClient');
  }
  // Get expiration or default to 24 hours
  const expiration = process.env.LIT_SESSION_EXPIRATION || new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const siweMsg = {
    domain: domain,
    statement: 'Sign-in to VaultLayer.xyz - SmartVault',
    uri: domain == 'localhost' ? 'http://localhost:3000' : `https://${domain}`,
    expiration: expiration,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nonce: litNodeClient.latestBlockhash!,
  };
  const toSign = `${domain} wants you to sign in with your Bitcoin account:\n${address}\n\n${siweMsg.statement}\n\nURI: ${siweMsg.uri}\nNonce: ${siweMsg.nonce}\nExpiration Time: ${siweMsg.expiration}`;

  const signature = await signMessage(toSign);
  const authSig = {
    sig: signature,
    derivedVia: 'bitcoin.signMessage',
    signedMessage: toSign,
    address: address,
  };
  const authMethod = {
    authMethodType: BITCOIN_AUTH_METHOD_TYPE,
    accessToken: JSON.stringify(authSig),
  };

  return authMethod;
}

/**
 * Fetch PKPs associated with given auth method
 */
export async function getPKPs(apiUrl: string, authMethod: AuthMethod): Promise<Vault[]> {
  try {
    const allPKPs = await fetch(`${apiUrl}/api/v1/vault/list`, {
      method: 'post',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(authMethod),
    }).then((result) => result.json());
    if (allPKPs) return allPKPs;
    else return [];
  } catch (error: any) {
    console.error(`Failed to getPKPs: ${error?.response?.data ?? error}`);
    throw new Error('Failed to getPKPs');
  }
}

/**
 * Mint a new PKP for current auth method
 */
export async function mintPKP(authMethod: AuthMethod, apiUrl: string): Promise<Vault> {
  try {
    const response = await fetch(`${apiUrl}/api/v1/vault/create`, {
      method: 'post',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(authMethod),
    });
    console.log('Minting response:', response);
    if (response.ok) {
      const newPKP: Vault = await response.json();
      return newPKP;
    } else {
      throw new Error(`Minting failed, ${response.text()}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to mintPKP: ${error.response.data ?? error}`);
  }
}
