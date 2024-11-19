const { wallet, address, tapscript, crypto } = require('bitcoin-sdk-js');


const { removeSaltFromDecryptedKey } = require('../../utils');

/**
 *
 * Bundles bitcoin-sdk-js package as it's required to sign a message with the Bitcoin wallet which is also decrypted inside the Lit Action.
 *
 * @jsParam pkpAddress - The Eth address of the PKP which is associated with the Wrapped Key
 * @jsParam ciphertext - For the encrypted Wrapped Key
 * @jsParam dataToEncryptHash - For the encrypted Wrapped Key
 * @jsParam messageToSign: Uint8Array - The unsigned message to be signed by the Wrapped Key
 * @jsParam addressType: 'segwit' | 'taproot' - type of Bitcoin address to sign with
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
  const publicKey = wallet.getPublicKey(privateKey);

  let bitcoinAddress;
  if ( addressType && addressType === 'taproot' ){
    bitcoinAddress = await address.generateAddress(
      (
        await tapscript.getTapTweakedPubkey(
          publicKey.slice(2),
          await tapscript.getTapTweak(publicKey.slice(2)),
        )
      ).tweakedPubKey,
      'taproot',
    );
  } else {
    bitcoinAddress = await address.generateAddress(
      publicKey,
      'segwit',
    );
  }
  
  let signature;
  try {
    signature = await crypto.signMessage(
      messageToSign,
      privateKey,
      bitcoinAddress
    )
  } catch (error) {
    Lit.Actions.setResponse({
      response: `Error: When signing message: ${error.message}`,
    });
    return;
  }

  try {
    const isValid = await crypto.verifyMessage(
      messageToSign,
      signature,
      bitcoinAddress
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
