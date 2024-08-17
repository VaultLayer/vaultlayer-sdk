import coinSelect from '../lib/coinselect-segwit';
import { networks, payments, Psbt, Transaction } from 'bitcoinjs-lib';
import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinRPC } from './bitcoinRpc';
import axios from 'axios';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import { toOutputScript } from 'bitcoinjs-lib/src/address';

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
