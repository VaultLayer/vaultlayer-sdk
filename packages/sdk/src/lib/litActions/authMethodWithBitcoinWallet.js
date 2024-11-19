// @ts-nocheck
const { Verifier } = require('bip322-js');

/**
 *
 * Bundles bip322-js package as it's required to sign a message with the Bitcoin wallet which is also decrypted inside the Lit Action.
 *
 * @jsParam pkpTokenId
 * @jsParam network
 * @jsParam accessToken - Includes message signed with Bitcoin BIP322 (P2PKH, P2WPKH, P2TR)
 *
 * @returns { Promise<string> } - Returns true or false if the auth was sucessful
 */

(async () => {
    const LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS = { 
        'datil': "0x213Db6E1446928E19588269bEF7dFc9187c4829A",
        'datil-test': "0x60C1ddC8b9e38F730F0e7B70A2F84C1A98A69167",
        'datil-dev': "0xf64638F1eb3b064f5443F7c9e2Dc050ed535D891"
      };
    const BITCOIN_AUTH_METHOD_TYPE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("BITCOIN_BIP322_v0_3")
    );
    const IS_PERMITTED_AUTH_METHOD_INTERFACE = new ethers.utils.Interface([
      "function isPermittedAuthMethod(uint256 tokenId, uint256 authMethodType, bytes memory id) public view returns (bool)",
    ]);

    console.log("BITCOIN_BIP322 authSig:",accessToken);
    console.log("BITCOIN_BIP322 network:",network);
  
    try {
      const authSig = JSON.parse(accessToken);
      const permissionsContract = network ? LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS[network] : LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS['datil-dev']
      
      console.log("BITCOIN_BIP322 permissionsContract:", permissionsContract);

      const isValid = Verifier.verifySignature(authSig.address, authSig.signedMessage, authSig.sig);
      if (!isValid) {
        console.log("BITCOIN_BIP322 Invalid Bitcoin BIP322 (P2PKH, P2WPKH, P2TR) signature");
        return Lit.Actions.setResponse({
          response: "false",
          reason: "Invalid Bitcoin BIP322 (P2PKH, P2WPKH, P2TR) signature",
        });
      }
      const expirationTime = authSig.signedMessage.split('Expiration Time: ')[1].split('\n')[0];
      const isRecent = Date.now() / 1000 < new Date(expirationTime);
      if (!isRecent) {
        console.log("Authenticated Bitcoin signature expired");
        return Lit.Actions.setResponse({
          response: "false",
          reason: "Authenticated Bitcoin signature expired",
        });
      }
  
      // Checking if user's authMethodId is a permitted Auth Method for pkpTokenId
      const authMethodId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(`${authSig.address}:lit`)
      );
      
      const abiEncodedData =
        IS_PERMITTED_AUTH_METHOD_INTERFACE.encodeFunctionData(
          "isPermittedAuthMethod",
          [pkpTokenId, BITCOIN_AUTH_METHOD_TYPE, authMethodId]
        );
      const isPermittedTx = {
        to: permissionsContract,
        data: abiEncodedData,
      };
      const isPermitted = await Lit.Actions.callContract({
        chain: "yellowstone",
        txn: ethers.utils.serializeTransaction(isPermittedTx),
      });
      if (!isPermitted) {
        console.log("BITCOIN_BIP322 Bitcoin address is not authorized to use this PKP");
        return Lit.Actions.setResponse({
          response: "false",
          reason: "Bitcoin address is not authorized to use this PKP",
        });
      }
  
      return Lit.Actions.setResponse({ response: "true" });
    } catch (error) {
      console.log("BITCOIN_BIP322 Error:",error.message);
      return Lit.Actions.setResponse({
        response: "false",
        reason: `Error: ${error.message}`,
      });
    }
})();
