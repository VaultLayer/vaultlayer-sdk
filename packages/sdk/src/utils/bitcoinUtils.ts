import coinSelect from '../lib/coinselect-segwit';
import { networks, payments, Psbt, Transaction } from 'bitcoinjs-lib';
import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinRPC } from './bitcoinRpc';
import axios from 'axios';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import { toOutputScript } from 'bitcoinjs-lib/src/address';
import { BIP322, Address } from 'bip322-js';

export interface WitnessUtxo {
  script: Buffer;
  value: number;
}
export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  scriptPk?: string;
  scriptType?: string;
  status?: any;
  witnessUtxo?: WitnessUtxo;
}

export type BTCAddress = {
  network: string;
  address: string;
  publicKey: string;
  purpose: 'payment' | 'ordinals';
  type: 'p2tr' | 'p2wpkh' | 'p2sh' | 'p2pkh';
};

const ECPair = ECPairFactory(ecc);
export function reverseBuffer(buffer: Buffer): Buffer {
  if (buffer.length < 1) return buffer;
  let j = buffer.length - 1;
  let tmp = 0;
  for (let i = 0; i < buffer.length / 2; i++) {
    tmp = buffer[i];
    buffer[i] = buffer[j];
    buffer[j] = tmp;
    j--;
  }
  return buffer;
}

function toXOnly(pubkey: Buffer): Buffer {
  return pubkey.subarray(1, 33);
}

export const validator = (pubkey: Buffer, msghash: Buffer, signature: Buffer): boolean =>
  ECPair.fromPublicKey(pubkey).verify(msghash, signature);

/**
 * Converts an Ethereum public key to a Bitcoin pubkey
 * @param {string} ethPubKey - Ethereum public key (compressed or uncompressed)
 * @returns {Buffer} Bitcoin pubkey
 */
export const getBtcPubkey = (ethPubKey: string): string => {
  let compressedPoint: Uint8Array;
  if (ethPubKey.length === 130) {
    compressedPoint = ecc.pointCompress(Buffer.from(ethPubKey, 'hex'), true);
  } else if (ethPubKey.length === 132) {
    if (ethPubKey.slice(0, 2) !== '0x') {
      throw new Error('Invalid Ethereum public key');
    }
    compressedPoint = ecc.pointCompress(Buffer.from(ethPubKey.slice(2), 'hex'), true);
  } else if (ethPubKey.length === 66) {
    compressedPoint = Buffer.from(ethPubKey, 'hex');
  } else if (ethPubKey.length === 68) {
    if (ethPubKey.slice(0, 2) !== '0x') {
      throw new Error('Invalid Ethereum public key');
    }
    compressedPoint = Buffer.from(ethPubKey.slice(2), 'hex');
  } else {
    throw new Error('Invalid Ethereum public key');
  }
  const pubKey = Buffer.from(compressedPoint);
  return pubKey.toString('hex') as string;
};

export const getBtcAccounts = (btcPubKey: string, btcNetwork: 'testnet' | 'livenet'): BTCAddress[] => {
  const p2wpkh = payments.p2wpkh({
    pubkey: Buffer.from(btcPubKey, 'hex'),
    network: btcNetwork == 'testnet' ? networks.testnet : networks.bitcoin,
  });
  if (!p2wpkh) throw new Error('Could not generate p2wpkh address');

  const accounts = [
    {
      network: btcNetwork,
      address: p2wpkh?.address as string,
      publicKey: p2wpkh?.pubkey?.toString('hex') as string,
      purpose: 'payment' as const,
      type: 'p2wpkh' as const,
    },
  ];
  return accounts;
};

export function getAddressType(address: string, network = bitcoin.networks.bitcoin) {
  if (address.startsWith(`${network.bech32}1p`)) {
    bitcoin.address.fromBech32(address);
    return 'p2tr';
  }
  if (address.startsWith(network.bech32)) {
    bitcoin.address.fromBech32(address);
    return 'p2wpkh';
  }
  const base58Data = bitcoin.address.fromBase58Check(address);
  if (base58Data.version === Number(network.scriptHash)) {
    return 'p2sh-p2wpkh';
  }
  if (base58Data.version === Number(network.pubKeyHash)) {
    return 'p2pkh';
  }

  throw new Error('invalid address');
}

export const getAllUtxos = async (
  account: string,
  btcNetwork: 'testnet' | 'livenet',
  btcPubKey: string,
  bitcoinRpc: string
): Promise<any[]> => {
  const network = btcNetwork == 'livenet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

  const provider = new BitcoinRPC({
    network,
    bitcoinRpc,
  });

  const publicKey = Buffer.from(btcPubKey, 'hex');

  const addressType = getAddressType(account, network);

  //We only support  P2PKH  P2WPKH P2SH-P2WPKH P2TR address
  let payment;
  if (addressType === 'p2pkh') {
    payment = bitcoin.payments.p2pkh({
      pubkey: publicKey,
      network,
    });
  } else if (addressType === 'p2wpkh') {
    payment = bitcoin.payments.p2wpkh({
      pubkey: publicKey,
      network,
    });
  } else if (addressType === 'p2sh-p2wpkh') {
    payment = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: publicKey,
        network,
      }),
      network,
    });
  } else if (addressType === 'p2tr') {
    bitcoin.initEccLib(ecc);
    payment = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(publicKey),
      network,
    });
  }

  if (!payment) {
    throw new Error('payment is undefined');
  }

  if (payment?.address !== account) {
    throw new Error('payment does not match the account.');
  }

  if (!payment.output) {
    throw new Error('failed to create redeem script');
  }

  const res = await provider.getUTXOs(account!);

  const rawTxMap: Record<string, string> = {};

  if (addressType === 'p2pkh') {
    for (let i = 0; i < res.length; i++) {
      const utxo = res[i];
      if (!rawTxMap[utxo.txid]) {
        const hex = await provider.getRawTransaction(utxo.txid);
        rawTxMap[utxo.txid] = hex;
      }
    }
  }

  const utxos = res.map((utxo) => ({
    ...utxo,
    ...(addressType.includes('p2pkh') && {
      nonWitnessUtxo: Buffer.from(rawTxMap[utxo.txid], 'hex'),
    }),
    ...((addressType.includes('p2wpkh') || addressType.includes('p2tr')) && {
      witnessUtxo: {
        script: addressType.includes('p2sh') ? payment!.redeem!.output! : payment!.output!,
        value: utxo.value,
      },
    }),
    ...(addressType.includes('p2sh') && {
      redeemScript: payment!.redeem!.output,
    }),
    ...(addressType.includes('p2tr') && {
      isTaproot: true,
    }),
    sequence: 0xffffffff - 1,
  }));

  return utxos;
};

export const getAvailableUtxos = async (account: string, btcNetwork: 'testnet' | 'livenet'): Promise<any[]> => {
  const utxosResponse = await axios.get(`http://localhost:3001/api/v1/portfolio/utxos?address=${account}`, {
    headers: {
      Accept: 'application/json',
    },
  });
  console.log('utxosResponse:', utxosResponse.data);

  const utxos = utxosResponse?.data.utxos?.map((utxo: { txid: any; vout: any; satoshi: any; address: string }) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.satoshi,
    witnessUtxo: {
      script: toOutputScript(
        utxo.address,
        btcNetwork === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
      ),
      value: utxo.satoshi,
    },
  }));

  return utxos;
};

// feeRate: satoshis per byte
export const prepareTransaction = (
  utxos: UTXO[],
  recipientAddress: string,
  amount: number,
  changeAddress: string,
  feeRate: number
): any => {
  const targets = [
    {
      address: recipientAddress,
      value: amount,
    },
  ];

  // ...
  const { inputs, outputs, fee } = coinSelect(utxos, targets, feeRate, changeAddress) as any;

  // the accumulated fee is always returned for analysis
  console.log('prepareTransaction total fee: ', fee);

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) return { pstb: undefined, fee };

  console.log('prepareTransaction inputs: ', inputs);
  console.log('prepareTransaction outputs: ', outputs);

  const psbt = new Psbt({ network: networks.testnet });

  inputs.forEach((input: { txid: any; vout: any; witnessUtxo: any }) =>
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      // eslint-disable-next-line no-use-before-define
      witnessUtxo: input.witnessUtxo, // eslint-disable-line no-use-before-define
    })
  );
  outputs.forEach((output: { address: any; value: any }) => {
    psbt.addOutput({
      address: output.address,
      value: output.value,
    });
  });

  return { psbt, fee };
};

export const getSchnorrHash = (signerAddress: string, message: string, signatureBase64: string) => {
  // Convert address into corresponding script pubkey
  const scriptPubKey = Address.convertAdressToScriptPubkey(signerAddress);
  // Draft corresponding toSpend and toSign transaction using the message and script pubkey
  const toSpendTx = BIP322.buildToSpendTx(message, scriptPubKey);
  const toSignTx = BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey);
  // Add the witness stack into the toSignTx
  toSignTx.updateInput(0, {
    finalScriptWitness: Buffer.from(signatureBase64, 'base64'),
  });
  // Obtain the signature within the witness components
  const witness = toSignTx.extractTransaction().ins[0].witness;
  const encodedSignature = witness[0];

  // Check if the witness stack correspond to a single-key-spend P2TR address
  if (!Address.isSingleKeyP2TRWitness(witness)) {
    throw new Error('BIP-322 verification from script-spend P2TR is unsupported.');
  }
  // For taproot address, the public key is located starting from the 3rd byte of the script public key
  const publicKey = scriptPubKey.subarray(2);
  console.log('getSchnorrParams publicKey:', publicKey);
  // Compute the hash to be signed by the signing address
  // Reference: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#user-content-Taproot_key_path_spending_signature_validation
  let hashToSign: Buffer;
  let signature: Buffer;
  if (encodedSignature.byteLength === 64) {
    // If a BIP-341 signature is 64 bytes, the signature is signed using SIGHASH_DEFAULT 0x00
    hashToSign = getHashForSigP2TR(toSignTx, 0x00);
    // And the entirety of the encoded signature is the actual signature
    signature = encodedSignature;
  } else if (encodedSignature.byteLength === 65) {
    // If a BIP-341 signature is 65 bytes, the signature is signed using SIGHASH included at the last byte of the signature
    hashToSign = getHashForSigP2TR(toSignTx, encodedSignature[64]);
    // And encodedSignature[0:64] holds the actual signature
    signature = encodedSignature.subarray(0, -1);
  } else {
    // Fail validation if the signature is not 64 or 65 bytes
    throw new Error('Invalid Schnorr signature provided.');
  }
  return {
    hashToSign,
    publicKey,
    signature,
  };
};

export const getHashForSigP2TR = (toSignTx: bitcoin.Psbt, hashType: number) => {
  // BIP-322 states that 'all signatures must use the SIGHASH_ALL flag'
  // But, in BIP-341, SIGHASH_DEFAULT (0x00) is equivalent to SIGHASH_ALL (0x01) so both should be allowed
  if (hashType !== bitcoin.Transaction.SIGHASH_DEFAULT && hashType !== bitcoin.Transaction.SIGHASH_ALL) {
    // Throw error if hashType is neither SIGHASH_DEFAULT or SIGHASH_ALL
    throw new Error('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
  }
  if (!toSignTx.data.inputs[0].witnessUtxo) {
    throw new Error('No witnessUtxo used in signature');
  }
  // Return computed transaction hash to be signed
  return toSignTx.extractTransaction().hashForWitnessV1(0, [toSignTx.data.inputs[0].witnessUtxo.script], [0], hashType);
};

export const verifySchnorr = async (signerAddress: string, message: string, signatureBase64: string) => {
  const { hashToSign, publicKey, signature } = getSchnorrHash(signerAddress, message, signatureBase64);
  // Computing OP_CHECKSIG in Javascript
  return ecc.verifySchnorr(hashToSign, publicKey, signature);
};
