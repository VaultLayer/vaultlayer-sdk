import type {
  DiscordProvider,
  GoogleProvider,
  EthWalletProvider,
  WebAuthnProvider,
  LitAuthClient,
  BaseProvider,
} from '@lit-protocol/lit-auth-client';
import type { LitNodeClient } from '@lit-protocol/lit-node-client';
import { AuthMethodScope, AuthMethodType, ProviderType } from '@lit-protocol/constants';
import type { GetSessionSigsProps, IRelayPKP, SessionSigs } from '@lit-protocol/types';
import { AuthCallbackParams, AuthSig } from '@lit-protocol/types';
import { LitAbility, LitPKPResource, LitActionResource } from '@lit-protocol/auth-helpers';
import { createSiweMessageWithRecaps, generateAuthSig } from '@lit-protocol/auth-helpers';
import { ethers, utils } from 'ethers';
import { getSchnorrHash } from './bitcoinUtils';

export const BITCOIN_AUTH_METHOD_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('BITCOIN_BIP322_v0_3'));
export const BITCOIN_AUTH_LIT_ACTION_IPFS_CID = 'QmS1CJZrZ1HNgmwiGN85Lscov3ybbZ77yVLCs4UsAcmPjJ';
export const INSCRIPTION_AUTH_METHOD_TYPE = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('BITCOIN_INSCRIPTION_V0_11')
);
export const INSCRIPTION_AUTH_LIT_ACTION_IPFS_CID = 'QmXEHbZFSUR9GjS9xxncxjbdr67ek3X4HURkmUfdp1q8nR';
export const CAT721_AUTH_METHOD_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('BITCOIN_CAT721_V0_2'));
export const CAT721_AUTH_LIT_ACTION_IPFS_CID = 'Qmc4CsPLqErMr96p9a8Lfj9vbyieuwcS8exMDQKbZa2o2q';
export const NFT_AUTH_METHOD_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('NFT_V0'));
export const NFT_AUTH_LIT_ACTION_IPFS_CID = 'QmdouVTa366pWQHyndMzzerD83imY8GMm8tVAETKMrhLCu';

export interface AuthMethod {
  authMethodType: number | string;
  accessToken: string;
}

/**
 * Validate provider
 */
export function isSocialLoginSupported(provider: string): boolean {
  return ['google', 'discord'].includes(provider);
}

/**
 * Redirect to Lit login
 */
export async function signInWithGoogle(litAuthClient: LitAuthClient, redirectUri: string): Promise<void> {
  const googleProvider = litAuthClient.initProvider<GoogleProvider>(ProviderType.Google, { redirectUri });
  await googleProvider.signIn();
}

/**
 * Get auth method object from redirect
 */
export async function authenticateWithGoogle(
  litAuthClient: LitAuthClient,
  redirectUri: string
): Promise<AuthMethod | undefined> {
  const googleProvider = litAuthClient.initProvider<GoogleProvider>(ProviderType.Google, { redirectUri });
  const authMethod = await googleProvider.authenticate();
  return authMethod;
}

/**
 * Redirect to Lit login
 */
export async function signInWithDiscord(litAuthClient: LitAuthClient, redirectUri: string): Promise<void> {
  const discordProvider = litAuthClient.initProvider<DiscordProvider>(ProviderType.Discord, { redirectUri });
  await discordProvider.signIn();
}

/**
 * Get auth method object from redirect
 */
export async function authenticateWithDiscord(
  litAuthClient: LitAuthClient,
  redirectUri: string
): Promise<AuthMethod | undefined> {
  const discordProvider = litAuthClient.initProvider<DiscordProvider>(ProviderType.Discord, { redirectUri });
  const authMethod = await discordProvider.authenticate();
  return authMethod;
}

/**
 * Get auth method object by signing a message with an Ethereum wallet
 */
export async function authenticateWithEthWallet(
  litNodeClient: LitNodeClient | undefined,
  litAuthClient: LitAuthClient | undefined,
  domain: string,
  address: string,
  signMessage: (message: string) => Promise<string>
): Promise<AuthMethod> {
  if (!litNodeClient) {
    throw new Error('No litNodeClient');
  }
  if (!litAuthClient) {
    throw new Error('No litAuthClient');
  }
  const ethWalletProvider = litAuthClient.initProvider<EthWalletProvider>(ProviderType.EthWallet, {
    domain: domain,
    origin: domain == 'localhost' ? 'http://localhost:3000' : `https://${domain}`,
  });

  // Get expiration or default to 24 hours
  const expiration = process.env.LIT_SESSION_EXPIRATION || new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const toSign = await createSiweMessageWithRecaps({
    domain: domain,
    statement: 'Sign-in to VaultLayer.xyz - SmartVault',
    uri: domain == 'localhost' ? 'http://localhost:3000' : `https://${domain}`,
    expiration: expiration,
    nonce: litNodeClient.latestBlockhash!,
    walletAddress: address,
    resources: [
      {
        resource: new LitPKPResource('*'),
        ability: LitAbility.PKPSigning,
      },
    ],
    litNodeClient,
  });

  console.log('authenticateWithEthWallet toSign', toSign);

  const signature = await signMessage(toSign);
  const authSig = {
    sig: signature,
    derivedVia: 'web3.eth.personal.sign',
    signedMessage: toSign,
    address: address,
  };
  const authMethod = {
    authMethodType: AuthMethodType.EthWallet,
    accessToken: JSON.stringify(authSig),
  };

  return authMethod;
}

/**
 * Get auth method object by signing a message with a Bitcoin wallet
 */
export async function authenticateWithBtcWallet(
  litNodeClient: LitNodeClient | undefined,
  litAuthClient: LitAuthClient | undefined,
  domain: string,
  address: string,
  signMessage: (message: string) => Promise<string>
): Promise<AuthMethod> {
  if (!litNodeClient) {
    throw new Error('No litNodeClient');
  }
  if (!litAuthClient) {
    throw new Error('No litAuthClient');
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
 * Get auth method object by signing a message with a Bitcoin wallet
 */
export async function authenticateWithBtcOrdinal(
  litNodeClient: LitNodeClient | undefined,
  litAuthClient: LitAuthClient | undefined,
  domain: string,
  address: string,
  lsvId: string,
  signMessage: (message: string) => Promise<string>
): Promise<AuthMethod> {
  if (!litNodeClient) {
    throw new Error('No litNodeClient');
  }
  if (!litAuthClient) {
    throw new Error('No litAuthClient');
  }
  const inscriptionId = lsvId.split(':')[1];

  // Get expiration or default to 24 hours
  const expiration = process.env.LIT_SESSION_EXPIRATION || new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const siweMsg = {
    domain: domain,
    statement: `Sign-in to VaultLayer.xyz - Liquid Staking Vault with inscriptionId: ${inscriptionId}`,
    uri: domain == 'localhost' ? 'http://localhost:3000' : `https://${domain}`,
    expiration: expiration,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nonce: litNodeClient.latestBlockhash!,
  };
  const toSign = `${domain} wants you to sign in with your Bitcoin account:\n${address}\n\n${siweMsg.statement}\n\nURI: ${siweMsg.uri}\nNonce: ${siweMsg.nonce}\nExpiration Time: ${siweMsg.expiration}`;

  const signatureBase64 = await signMessage(toSign);
  const { hashToSign, publicKey, signature } = getSchnorrHash(address, toSign, signatureBase64);
  const authSig = {
    sig: signatureBase64,
    derivedVia: 'bitcoin.schnorr.signMessage',
    signedMessage: toSign,
    signature: signature.toString('base64'),
    hashToSign: hashToSign.toString('hex'),
    publicKey: publicKey.toString('hex'),
    address: address,
    inscriptionId: inscriptionId,
  };
  const authMethod = {
    authMethodType: INSCRIPTION_AUTH_METHOD_TYPE,
    accessToken: JSON.stringify(authSig),
  };

  return authMethod;
}

/**
 * Get auth method object by signing a message with a Bitcoin wallet
 */
export async function authenticateWithBtcCat721(
  litNodeClient: LitNodeClient | undefined,
  litAuthClient: LitAuthClient | undefined,
  domain: string,
  address: string,
  lsvId: string,
  signMessage: (message: string) => Promise<string>
): Promise<AuthMethod> {
  if (!litNodeClient) {
    throw new Error('No litNodeClient');
  }
  if (!litAuthClient) {
    throw new Error('No litAuthClient');
  }

  // Get expiration or default to 24 hours
  const expiration = process.env.LIT_SESSION_EXPIRATION || new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const siweMsg = {
    domain: domain,
    statement: `Sign-in to VaultLayer.xyz - Liquid Staking Vault with lsvId: ${lsvId}`,
    uri: domain == 'localhost' ? 'http://localhost:3000' : `https://${domain}`,
    expiration: expiration,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nonce: litNodeClient.latestBlockhash!,
  };
  const toSign = `${domain} wants you to sign in with your Bitcoin account:\n${address}\n\n${siweMsg.statement}\n\nURI: ${siweMsg.uri}\nNonce: ${siweMsg.nonce}\nExpiration Time: ${siweMsg.expiration}`;

  const signatureBase64 = await signMessage(toSign);
  const { hashToSign, publicKey, signature } = getSchnorrHash(address, toSign, signatureBase64);
  const authSig = {
    sig: signatureBase64,
    derivedVia: 'bitcoin.schnorr.signMessage',
    signedMessage: toSign,
    signature: signature.toString('base64'),
    hashToSign: hashToSign.toString('hex'),
    publicKey: publicKey.toString('hex'),
    address: address,
    collectionId: lsvId.split(':')[1],
    localId: lsvId.split(':')[2],
  };
  const authMethod = {
    authMethodType: CAT721_AUTH_METHOD_TYPE,
    accessToken: JSON.stringify(authSig),
  };

  return authMethod;
}

/**
 * Register new WebAuthn credential
 */
export async function registerWebAuthn(litAuthClient: LitAuthClient): Promise<IRelayPKP> {
  const provider = litAuthClient.initProvider<WebAuthnProvider>(ProviderType.WebAuthn);
  // Register new WebAuthn credential
  const options = await provider.register();

  // Verify registration and mint PKP through relay server
  const txHash = await provider.verifyAndMintPKPThroughRelayer(options);
  const response = await provider.relay.pollRequestUntilTerminalState(txHash);
  if (response.status !== 'Succeeded') {
    throw new Error('Minting failed');
  }
  const newPKP: IRelayPKP = {
    tokenId: response.pkpTokenId as string,
    publicKey: response.pkpPublicKey as string,
    ethAddress: response.pkpEthAddress as string,
  };
  return newPKP;
}

/**
 * Get auth method object by authenticating with a WebAuthn credential
 */
export async function authenticateWithWebAuthn(litAuthClient: LitAuthClient): Promise<AuthMethod | undefined> {
  let provider = litAuthClient.getProvider(ProviderType.WebAuthn);
  if (!provider) {
    provider = litAuthClient.initProvider<WebAuthnProvider>(ProviderType.WebAuthn);
  }
  const authMethod = await provider.authenticate();
  return authMethod;
}

/**
 * Get auth method object by validating Stytch JWT
 */
export async function authenticateWithStytch(
  litAuthClient: LitAuthClient,
  accessToken: string,
  userId?: string,
  method?: string
) {
  let provider: BaseProvider;
  if (method === 'email') {
    provider = litAuthClient.initProvider(ProviderType.StytchEmailFactorOtp, {
      appId: process.env.NEXT_PUBLIC_STYTCH_PROJECT_ID as string,
    });
  } else {
    provider = litAuthClient.initProvider(ProviderType.StytchSmsFactorOtp, {
      appId: process.env.NEXT_PUBLIC_STYTCH_PROJECT_ID as string,
    });
  }

  // @ts-ignore
  const authMethod = await provider?.authenticate({ accessToken, userId });
  return authMethod;
}

/**
 * Fetch PKPs associated with given auth method
 */
export async function getPKPs(apiUrl: string, authMethod: AuthMethod): Promise<IRelayPKP[]> {
  try {
    const allPKPs = await fetch(`${apiUrl}/api/v1/vault/list`, {
      method: 'post',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(authMethod),
    }).then((result) => result.json());
    if (allPKPs) return allPKPs;
    else return [];
  } catch (error: any) {
    throw new Error(`Failed to broadcast transaction: ${error.response.data ?? error}`);
  }
}

/**
 * Mint a new PKP for current auth method
 */
export async function mintPKP(
  litAuthClient: LitAuthClient,
  authMethod: AuthMethod,
  apiUrl: string
): Promise<IRelayPKP> {
  const provider = getProviderByAuthMethod(litAuthClient, authMethod);
  // Set scope of signing any data
  const options = {
    permittedAuthMethodScopes: [[AuthMethodScope.SignAnything]],
  };

  let txHash: string;

  if (authMethod.authMethodType === AuthMethodType.WebAuthn) {
    // Register new WebAuthn credential
    const webAuthnInfo = await (provider as WebAuthnProvider).register();

    // Verify registration and mint PKP through relay server
    txHash = await (provider as WebAuthnProvider).verifyAndMintPKPThroughRelayer(webAuthnInfo, options);

    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, 2000);
    });
    const response = await provider?.relay.pollRequestUntilTerminalState(txHash);
    console.log('mintPKPThroughRelayer response:', response);
    if (response?.status !== 'Succeeded') {
      throw new Error('Minting failed');
    }
    const newPKP: IRelayPKP = {
      tokenId: response.pkpTokenId as string,
      publicKey: response.pkpPublicKey as string,
      ethAddress: response.pkpEthAddress as string,
    };
    return newPKP;
  } else {
    try {
      const response = await fetch(`${apiUrl}/api/v1/vault/create`, {
        method: 'post',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(authMethod),
      });
      console.log('Minting response:', response);
      if (response.ok) {
        const newPKP: IRelayPKP = await response.json();
        return newPKP;
      } else {
        throw new Error(`Minting failed, ${response.text()}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to broadcast transaction: ${error.response.data ?? error}`);
    }
  }
}

/**
 * Get provider for given auth method
 */
function getProviderByAuthMethod(litAuthClient: LitAuthClient, authMethod: AuthMethod) {
  switch (authMethod.authMethodType) {
    case AuthMethodType.GoogleJwt:
      return litAuthClient.getProvider(ProviderType.Google);
    case AuthMethodType.Discord:
      return litAuthClient.getProvider(ProviderType.Discord);
    case AuthMethodType.EthWallet:
      return litAuthClient.getProvider(ProviderType.EthWallet);
    case AuthMethodType.WebAuthn:
      return litAuthClient.getProvider(ProviderType.WebAuthn);
    case AuthMethodType.StytchEmailFactorOtp:
      return litAuthClient.getProvider(ProviderType.StytchEmailFactorOtp);
    case AuthMethodType.StytchSmsFactorOtp:
      return litAuthClient.getProvider(ProviderType.StytchSmsFactorOtp);
    default:
      return;
  }
}

/**
 * signWithLitAction
 */
export async function signWithLitAction(
  litNodeClient: LitNodeClient | undefined,
  litAuthClient: LitAuthClient | undefined,
  authMethod: any,
  hashForSig: Buffer,
  pkpPublicKey: string,
  tokenId: string,
  unisatApiKey: string | undefined
): Promise<string> {
  if (!litNodeClient) {
    throw new Error('No litNodeClient');
  }
  if (!litAuthClient) {
    throw new Error('No litAuthClient');
  }
  if (!authMethod) {
    throw new Error('No authMethod');
  }
  console.log('signWithLitAction start');
  const litActionCode = `
    const go = async () => {
    // The params toSign, publicKey, sigName are passed from the jsParams fields and are available here
    const sigShare = await Lit.Actions.signEcdsa({ toSign, publicKey, sigName });
    };

    go();
`;

  // Get session signatures for the given PKP public key and auth method
  let controllerSessionSigs: any;
  if (authMethod.authMethodType == AuthMethodType.EthWallet) {
    controllerSessionSigs = await litNodeClient.getPkpSessionSigs({
      pkpPublicKey: pkpPublicKey,
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
  } else if (authMethod.authMethodType == BITCOIN_AUTH_METHOD_TYPE) {
    controllerSessionSigs = await litNodeClient.getPkpSessionSigs({
      pkpPublicKey: pkpPublicKey,
      litActionIpfsId: BITCOIN_AUTH_LIT_ACTION_IPFS_CID,
      jsParams: {
        accessToken: authMethod.accessToken,
        network: 'datil',
        pkpTokenId: tokenId,
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
  } else if (authMethod.authMethodType == INSCRIPTION_AUTH_METHOD_TYPE) {
    controllerSessionSigs = await litNodeClient.getPkpSessionSigs({
      pkpPublicKey: pkpPublicKey,
      litActionIpfsId: INSCRIPTION_AUTH_LIT_ACTION_IPFS_CID,
      jsParams: {
        accessToken: authMethod.accessToken,
        network: 'datil',
        pkpTokenId: tokenId,
        unisatApiKey: unisatApiKey,
        debug: true,
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
  } else if (authMethod.authMethodType == CAT721_AUTH_METHOD_TYPE) {
    controllerSessionSigs = await litNodeClient.getPkpSessionSigs({
      pkpPublicKey: pkpPublicKey,
      litActionIpfsId: CAT721_AUTH_LIT_ACTION_IPFS_CID,
      jsParams: {
        accessToken: authMethod.accessToken,
        network: 'datil',
        pkpTokenId: tokenId,
        debug: true,
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
  console.log('signWithLitAction controllerSessionSigs', controllerSessionSigs);

  const { signatures } = (await litNodeClient.executeJs({
    code: litActionCode,
    sessionSigs: controllerSessionSigs,
    jsParams: {
      toSign: hashForSig,
      publicKey: pkpPublicKey,
      sigName: 'sig1',
    },
  })) as any;

  console.log('lit signatures: ', signatures);

  const { sig1 } = signatures;
  return sig1;
}
