import coinSelect from "../lib/coinselect-segwit";
import { networks, payments, Psbt, Transaction } from 'bitcoinjs-lib';
import ECPairFactory from "ecpair";
import * as ecc from "@bitcoin-js/tiny-secp256k1-asmjs";
import { toOutputScript } from "bitcoinjs-lib/src/address";

const btcApiEndpoint = "https://mempool.space";

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
  address: string;
  publicKey: string;
  purpose: 'payment' | 'ordinals';
  type: 'p2tr' | 'p2wpkh' | 'p2sh' | 'p2pkh';
}

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

export const validator = (
  pubkey: Buffer,
  msghash: Buffer,
  signature: Buffer,
): boolean => ECPair.fromPublicKey(pubkey).verify(msghash, signature);


/**
   * Converts an Ethereum public key to a Bitcoin address
   * @param {string} ethPubKey - Ethereum public key (compressed or uncompressed)
   * @returns [btcAddress] array of Bitcoin address
   * @example
   * const btcAddress = generateBtcAddress("0x043fd854ac22b8c80eadd4d8354ab8e74325265a065e566d82a21d578da4ef4d7af05d27e935d38ed28d5fda657e46a0dc4bab62960b4ad586b9c22d77f786789a");
   */
export const getBtcAccounts = (ethPubKey: string, btcTestNet: boolean): BTCAddress[] => {
  let compressedPoint: Uint8Array;
  if (ethPubKey.length === 130) {
    compressedPoint = ecc.pointCompress(Buffer.from(ethPubKey, "hex"), true);
  } else if (ethPubKey.length === 132) {
    if (ethPubKey.slice(0, 2) !== "0x") {
      throw new Error("Invalid Ethereum public key");
    }
    compressedPoint = ecc.pointCompress(
      Buffer.from(ethPubKey.slice(2), "hex"),
      true,
    );
  } else if (ethPubKey.length === 66) {
    compressedPoint = Buffer.from(ethPubKey, "hex");
  } else if (ethPubKey.length === 68) {
    if (ethPubKey.slice(0, 2) !== "0x") {
      throw new Error("Invalid Ethereum public key");
    }
    compressedPoint = Buffer.from(ethPubKey.slice(2), "hex");
  } else {
    throw new Error("Invalid Ethereum public key");
  }

  /* //too old
      const p2pkh = payments.p2pkh({
        pubkey: Buffer.from(compressedPoint),
        network: btcTestNet
        ? networks.testnet
        : networks.bitcoin,
      });
      if (!p2pkh) throw new Error("Could not generate p2pkh address");
  */
  const p2wpkh = payments.p2wpkh({
    pubkey: Buffer.from(compressedPoint),
    network: btcTestNet
      ? networks.testnet
      : networks.bitcoin,
  });
  if (!p2wpkh) throw new Error("Could not generate p2wpkh address");

  const accounts = [
    {
      address: p2wpkh?.address as string,
      publicKey: p2wpkh?.pubkey?.toString('hex') as string,
      purpose: 'payment' as 'payment',
      type: 'p2wpkh' as 'p2wpkh'
    }
  ]
  return accounts;
}

// feeRate: satoshis per byte
export const prepareTransaction = (utxos: UTXO[], recipientAddress: string, amount: number, changeAddress: string, feeRate: number): any => {
  let targets = [
    {
      address: recipientAddress,
      value: amount
    }
  ]

  // ...
  let { inputs, outputs, fee } = coinSelect(utxos, targets, feeRate, changeAddress) as any;

  // the accumulated fee is always returned for analysis
  console.log('prepareTransaction total fee: ', fee)


  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) return { pstb: undefined, fee };

  console.log('prepareTransaction inputs: ', inputs)
  console.log('prepareTransaction outputs: ', outputs)

  let psbt = new Psbt({ network: networks.testnet })
  
  inputs.forEach((input: { txid: any; vout: any; witnessUtxo: any; }) =>
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      // eslint-disable-next-line no-use-before-define
      witnessUtxo: input.witnessUtxo, // eslint-disable-line no-use-before-define
    })
  )
  outputs.forEach((output: { address: any; value: any; }) => {
    psbt.addOutput({
      address: output.address,
      value: output.value,
    })
  })

  return { psbt, fee };
};

/**
 * Broadcasts a signed transaction to the Bitcoin network
 * @param {bitcoin.Transaction} transaction - Signed transaction
 * @returns {Promise<string>} Transaction ID
 * @example
 * const signedTransaction = sdk.signFirstBtcUtxo({
 *  pkpPublicKey: "0x043fd854ac22b8c80eadd4d8354ab8e74325265a065e566d82a21d578da4ef4d7af05d27e935d38ed28d5fda657e46a0dc4bab62960b4ad586b9c22d77f786789a",
 *  fee: 24,
 *  recipientAddress: "1JwSSubhmg6iPtRjtyqhUYYH7bZg3Lfy1T",
 * })
 * const txId = await sdk.broadcastBtcTransaction(signedTransaction)
 */
export const broadcastBtcTransaction = async (
  txHex: string,
  btcTestNet: boolean
): Promise<string> => {
  try {
    const response = await fetch(
      `${btcApiEndpoint}/${btcTestNet ? "testnet/" : null}api/tx`,
      {
        method: "POST",
        body: txHex,
      },
    );
    const data = await response.text();
    return data;
  } catch (err) {
    console.log(err);
    throw new Error("Error broadcasting transaction: " + err);
  }
}