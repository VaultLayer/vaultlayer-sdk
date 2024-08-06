import { bytesToHex, publicToAddress, toBytes, toChecksumAddress, toRpcSig } from '@ethereumjs/util';
import bitcore from 'bitcore-lib';

export const pubKeyToEthAddress = (pubKey: string) => {
  const address = toChecksumAddress(bytesToHex(publicToAddress(toBytes(`0x${pubKey}`), true)));
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


export const convertSignature = (signature: string) => {
  const sig = (bitcore.crypto.Signature as any).fromCompact(Buffer.from(signature, 'base64'));
  const v = BigInt(sig.i + 27);
  const ethSignature = toRpcSig(v, sig.r.toBuffer(), sig.s.toBuffer());
  return ethSignature;
};
