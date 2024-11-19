/**
 *
 * Bundles bitcoin-sdk-js package as it's required to generate a random Bitcoin key and only allows the provided PKP to to decrypt it
 *
 * @jsParam pkpAddress - The Eth address of the PKP which is associated with the Wrapped Key
 * @jsParam accessControlConditions - The access control condition that allows only the pkpAddress to decrypt the Wrapped Key
 *
 * @returns { Promise<string> } - Returns a stringified JSON object with ciphertext & dataToEncryptHash which are the result of the encryption. Also returns the publicKey of the newly generated Bitcoin Wrapped Key.
 */

const { wallet } = require('bitcoin-sdk-js');

(async () => {
  const LIT_PREFIX = 'lit_';

  const resp = await Lit.Actions.runOnce(
    { waitForResponse: true, name: 'encryptedPrivateKey' },
    async () => {
      const bitcoinKeypair = await wallet.generateKeyPair();
      const privateKey =
        LIT_PREFIX + Buffer.from(bitcoinKeypair.privateKey).toString('hex');
      let utf8Encode = new TextEncoder();
      const to_encrypt = utf8Encode.encode(privateKey);

      const { ciphertext, dataToEncryptHash } = await Lit.Actions.encrypt({
        accessControlConditions,
        to_encrypt,
      });
      return JSON.stringify({
        ciphertext,
        dataToEncryptHash,
        publicKey: bitcoinKeypair.publicKey,
      });
    }
  );

  Lit.Actions.setResponse({
    response: resp,
  });
})();
