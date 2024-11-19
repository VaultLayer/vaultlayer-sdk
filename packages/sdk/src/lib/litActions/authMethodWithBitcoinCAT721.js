// @ts-nocheck
const ecc = require('@bitcoinerlab/secp256k1');
const { bech32m } = require('bech32');

/**
 *
 * Bundles bip322-js package as it's required to sign a message with the Bitcoin wallet which is also decrypted inside the Lit Action.
 *
 * @jsParam pkpTokenId
 * @jsParam network
 * @jsParam accessToken - Includes message signed with Bitcoin BIP322 (P2PKH, P2WPKH, P2TR)
 * @jsParam debug
 * @returns { Promise<string> } - Returns true or false if the auth was sucessful
 */
(async () => {
    /*// Check if address owns CAT-721 token with the specified localId
    const checkCat721 = async (address, collectionId, localId) => {
      const response = await fetch(`${CAT_TRACKER_API_URI}/collections/${collectionId}/addresses/${address}/utxos`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.code === 0 && data.data.utxos.length > 0) {
          const utxos = data.data.utxos;
          for (let utxo of utxos) {
            if (utxo.state.localId === localId) {
              return true;
            }
          }
        }
      }
      return false;
    };*/

    const getTaprootAddressFromPublicKey = (publicKeyBuffer) => {
      // Step 1: Apply SHA256 to the public key (not needed if public key is already x-only format)
      const tweakedPubKey = publicKeyBuffer;  // Assuming the public key is already in 32-byte format
    
      // Step 2: Convert the tweaked public key into bech32m format for Taproot
      const words = bech32m.toWords(tweakedPubKey);
      words.unshift(0x01);  // Taproot version byte (0x01)
    
      // Step 3: Encode the bech32m words into a Taproot address (using Bitcoin mainnet prefix 'bc')
      const taprootAddress = bech32m.encode('bc', words);
    
      return taprootAddress;
    };

    const LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS = { 
        'datil': "0x213Db6E1446928E19588269bEF7dFc9187c4829A",
        'datil-test': "0x60C1ddC8b9e38F730F0e7B70A2F84C1A98A69167",
        'datil-dev': "0xf64638F1eb3b064f5443F7c9e2Dc050ed535D891"
      };
      
      const CAT_TRACKER_API_URI = 'https://tracker.catprotocol.org/api';

    const INSCRIPTION_AUTH_METHOD_TYPE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("BITCOIN_CAT721_V0_2")
    );
    const IS_PERMITTED_AUTH_METHOD_INTERFACE = new ethers.utils.Interface([
      "function isPermittedAuthMethod(uint256 tokenId, uint256 authMethodType, bytes memory id) public view returns (bool)",
    ]);

    if (debug) console.log("BITCOIN_CAT721 authSig:",accessToken);
    if (debug) console.log("BITCOIN_CAT721 network:",network);
  
    try {
      const authSig = JSON.parse(accessToken);
      const permissionsContract = network ? LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS[network] : LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS['datil-dev']
      
      if (debug) console.log("BITCOIN_CAT721 permissionsContract:", permissionsContract);
      const hashToSign = Buffer.from(authSig.hashToSign, 'hex');
      if (debug) console.log("BITCOIN_CAT721 hashToSign:", hashToSign);
      const publicKey = Buffer.from(authSig.publicKey, 'hex');
      if (debug) console.log("BITCOIN_CAT721 publicKey:", publicKey);
      const signature = Buffer.from(authSig.signature, 'base64');
      if (debug) console.log("BITCOIN_CAT721 signature:", signature);

      const isValid = ecc.verifySchnorr(hashToSign, publicKey, signature);
      if (!isValid) {
        console.log("BITCOIN_CAT721 Invalid Bitcoin BIP322 (P2PKH, P2WPKH, P2TR) signature");
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
  
      //Verify address owns CAT-721
      const taprootAddress = getTaprootAddressFromPublicKey(publicKey);
      if (debug) console.log('BITCOIN_CAT721 taprootAddress from pubkey: ', taprootAddress);


      // the code in the function given to runOnce below will only be run by one node
      // the result returned will broadcast to all other nodes
      let isOwner = await Lit.Actions.runOnce({ waitForResponse: true, name: "checkCat721" }, async () => {
        const response = await fetch(`${CAT_TRACKER_API_URI}/collections/${authSig.collectionId}/addresses/${taprootAddress}/utxos`, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
          }
        });
      
        if (response.ok) {
          const data = await response.json();
          if (data && data.code === 0 && data.data.utxos.length > 0) {
            const utxos = data.data.utxos;
            for (let utxo of utxos) {
              if (utxo.state.localId === authSig.localId) {
                return "true";
              }
            }
          }
        }
        return "false";
      });

      //const isOwner = await checkCat721(taprootAddress, authSig.collectionId, authSig.localId);
      if (isOwner !== "true") {
        console.log("Bitcoin address is not inscriptionID owner:", taprootAddress);
        return Lit.Actions.setResponse({
          response: "false",
          reason: "Bitcoin address is not inscriptionID owner",
        });
      }      
      
      // Checking if user's authMethodId is a permitted Auth Method for pkpTokenId
      const authMethodId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(`cat721:${authSig.collectionId}:${authSig.localId}`)
      );

      const abiEncodedData =
        IS_PERMITTED_AUTH_METHOD_INTERFACE.encodeFunctionData(
          "isPermittedAuthMethod",
          [pkpTokenId, INSCRIPTION_AUTH_METHOD_TYPE, authMethodId]
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
        console.log("BITCOIN_CAT721 Bitcoin CAT-721 is not authorized to use this PKP");
        return Lit.Actions.setResponse({
          response: "false",
          reason: "Bitcoin CAT-721 is not authorized to use this PKP",
        });
      }
  
      return Lit.Actions.setResponse({ response: "true" });
    } catch (error) {
      console.log("BITCOIN_CAT721 Error:",error.message);
      return Lit.Actions.setResponse({
        response: "false",
        reason: `Error: ${error.message}`,
      });
    }
})();
