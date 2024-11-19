const { wallet, address, tapscript, crypto } = require('bitcoin-sdk-js');


const { removeSaltFromDecryptedKey } = require('../../utils');

/**
 *
 * Bundles bitcoin-sdk-js package as it's required to sign a message with the Bitcoin wallet which is also decrypted inside the Lit Action.
 *
 * @jsParam pkpAddress - The Eth address of the PKP which is associated with the Wrapped Key
 * @jsParam ciphertext - For the encrypted Wrapped Key
 * @jsParam dataToEncryptHash - For the encrypted Wrapped Key
 * @jsParam unsignedTransaction - The unsigned message to be signed by the Wrapped Key
 * @jsParam unsignedTransaction.hashToSign: Uint8Array - The unsigned message to be signed by the Wrapped Key
 * @jsParam unsignedTransaction.signatureType: 'ecdsa' | 'schnorr' - type of Bitcoin address to sign with
 * @jsParam unsignedTransaction.sigHashType: '01000000',
 * @jsParam accessControlConditions - The access control condition that allows only the pkpAddress to decrypt the Wrapped Key
 *
 * @returns { Promise<string> } - Returns a message signed by the Bitcoin Wrapped key. Or returns errors if any.
 */

(async () => {
  let decryptedPrivateKey;
  try {
    decryptedPrivateKey = await Lit.Actions.decryptToSingleNode({
      accessControlConditions,
      chain: 'ethereum',
      ciphertext,
      dataToEncryptHash,
      authSig: null,
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: `Error: When decrypting data to private key: ${error.message}`,
    });
    return;
  }

  if (!decryptedPrivateKey) {
    // Exit the nodes which don't have the decryptedData
    return;
  }

  let privateKey;
  try {
    privateKey = removeSaltFromDecryptedKey(decryptedPrivateKey);
    Lit.Actions.setResponse({ response: privateKey });
  } catch (err) {
    Lit.Actions.setResponse({ response: err.message });
    return;
  }
  const schnorrPubkey = wallet.getPublicKey(privateKey).slice(2); // remove first byte (which is parity bit)

  let signature;
  try {
    signature = await crypto.sign(
      unsignedTransaction.hashToSign,
      privateKey,
      unsignedTransaction.signatureType ? unsignedTransaction.signatureType : 'ecdsa',
      unsignedTransaction.sigHashType ? unsignedTransaction.sigHashType : '01000000'
    )
  } catch (error) {
    Lit.Actions.setResponse({
      response: `Error: When signing message: ${error.message}`,
    });
    return;
  }

  try {
    const isValid = await crypto.verify(
      signature,
      unsignedTransaction.hashToSign,
      schnorrPubkey,
      unsignedTransaction.signatureType ? unsignedTransaction.signatureType : 'ecdsa',
      unsignedTransaction.sigHashType ? unsignedTransaction.sigHashType : '01000000'
    );
    if (!isValid) {
      Lit.Actions.setResponse({
        response:
          'Error: Signature did not verify to expected Bitcoin public key',
      });
      return;
    }
  } catch (error) {
    Lit.Actions.setResponse({
      response: `Error: When validating signed message is valid: ${error.message}`,
    });
    return;
  }

  Lit.Actions.setResponse({ response: signature });
})();
