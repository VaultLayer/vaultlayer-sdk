import {
  bytesToHex,
  publicToAddress,
  toBytes,
  toChecksumAddress,
  toRpcSig,
  ecrecover,
  hashPersonalMessage,
  pubToAddress,
} from '@ethereumjs/util';
import { ethers } from 'ethers';
import bitcore from 'bitcore-lib';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';

const ECPair = ECPairFactory(ecc);

export const pubKeyToEthAddress = (pubKey: string) => {
  console.log('pubKeyToEthAddress pubKey: ', pubKey);
  const address = toChecksumAddress(bytesToHex(publicToAddress(toBytes(`0x${pubKey}`), true)));
  console.log('pubKeyToEthAddress address: ', address);

  const uncompressedPub = ECPair.fromPublicKey(Buffer.from(pubKey, 'hex'), { compressed: false }).publicKey;
  console.log('pubKeyToEthAddress uncompressedPub: ', uncompressedPub);
  console.log('pubKeyToEthAddress uncompressedPub hex: ', uncompressedPub.toString('hex'));
  const uncompressedPubHex = uncompressedPub.slice(1, 65).toString('hex');
  console.log('pubKeyToEthAddress uncompressedPub sliced: ', uncompressedPubHex);
  const publicAddress = toChecksumAddress(bytesToHex(publicToAddress(toBytes(`0x${uncompressedPubHex}`), true)));
  console.log('pubKeyToEthAddress publicAddress: ', publicAddress);
  return address;
};

/*
function btcSignatureToEvmSignature(bitcoinSignature: string) {
    const _bitcoinSignature: any = (bitcore.crypto.Signature as any).fromCompact(Buffer.from(bitcoinSignature, 'base64'));
    const ethSignature = joinSignature(
        splitSignature({
            recoveryParam: _bitcoinSignature.i,
            r: hexZeroPad('0x' + _bitcoinSignature.r.toString(16), 32),
            s: hexZeroPad('0x' + _bitcoinSignature.s.toString(16), 32),
        }),
    );

    return ethSignature;
}
*/

export const convertSignature = (signature: string, message: string) => {
  const sig = (bitcore.crypto.Signature as any).fromCompact(Buffer.from(signature, 'base64'));
  const v = BigInt(sig.i + 27);
  const ethSignature = toRpcSig(v, sig.r.toBuffer(), sig.s.toBuffer());
  const bitcoinMsg = '\u0018Bitcoin Signed Message:\n' + String(message.length) + message;
  const address = ethers.utils.recoverAddress(ethers.utils.hashMessage(bitcoinMsg), ethSignature);
  console.log('convertSignature address: ', address);
  console.log('convertSignature ethSignature: ', ethSignature);
  return ethSignature;
};

export const sigToEthAddress = (message: string, signature: string) => {
  const bitcoinMsg = '\u0018Bitcoin Signed Message:\n' + String(message.length) + message;
  const ethSignature = convertSignature(signature, message);
  const address = ethers.utils.recoverAddress(ethers.utils.hashMessage(bitcoinMsg), ethSignature);
  console.log('sigToEthAddress address: ', address);
  return address;
};

export const verifySignature = (message: string, signature: string, address: string) => {
  console.log('verifySignature address: ', address);
  const bitcoinMsg = '\u0018Bitcoin Signed Message:\n' + String(message.length) + message;
  const verifySignerBTC = ethers.utils.recoverAddress(ethers.utils.hashMessage(bitcoinMsg), signature);
  console.log('verifySignature verifySignerBTC: ', verifySignerBTC);
  //
  const ethMsg = '\x19Ethereum Signed Message:\n' + String(bitcoinMsg.length) + bitcoinMsg;
  const verifySigner = ethers.utils.recoverAddress(ethers.utils.hashMessage(ethMsg), signature);
  console.log('verifySignature verifySigner: ', verifySigner);
  if (verifySigner.toLowerCase() === address.toLowerCase()) return true;
  else return false;
};
