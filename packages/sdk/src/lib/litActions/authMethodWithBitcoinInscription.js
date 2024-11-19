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
 * @jsParam unisatApiKey
 * @jsParam debug
 * @returns { Promise<string> } - Returns true or false if the auth was sucessful
 */
(async () => {
    /*const checkUniSat = async (address, inscriptionId, apiUrl, apiKey) => {
      const response = await fetch(`${apiUrl}/v1/indexer/address/${address}/inscription-data`, {
          method: 'GET',
          headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${apiKey}`
          }
      });
    
      if (response.ok) {
          const data = await response.json();
          if (data && data.code === 0 && data.data.inscription.length > 0) {
              const inscriptions = data.data.inscription;
              for (let inscription of inscriptions) {
                  if (inscription.inscriptionId === inscriptionId) {
                      return true;
                  }
              }
          }
      }
      return false;
    }*/

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
      
    const UNISAT_LIVENET_URI = 'https://open-api.unisat.io';

    const INSCRIPTION_AUTH_METHOD_TYPE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("BITCOIN_INSCRIPTION_V0_11")
    );
    const IS_PERMITTED_AUTH_METHOD_INTERFACE = new ethers.utils.Interface([
      "function isPermittedAuthMethod(uint256 tokenId, uint256 authMethodType, bytes memory id) public view returns (bool)",
    ]);

    if (debug) console.log("BITCOIN_INSCRIPTION authSig:",accessToken);
    if (debug) console.log("BITCOIN_INSCRIPTION network:",network);
  
    try {
      const authSig = JSON.parse(accessToken);
      const permissionsContract = network ? LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS[network] : LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS['datil-dev']
      
      if (debug) console.log("BITCOIN_INSCRIPTION permissionsContract:", permissionsContract);
      const hashToSign = Buffer.from(authSig.hashToSign, 'hex');
      if (debug) console.log("BITCOIN_INSCRIPTION hashToSign:", hashToSign);
      const publicKey = Buffer.from(authSig.publicKey, 'hex');
      if (debug) console.log("BITCOIN_INSCRIPTION publicKey:", publicKey);
      const signature = Buffer.from(authSig.signature, 'base64');
      if (debug) console.log("BITCOIN_INSCRIPTION signature:", signature);

      const isValid = ecc.verifySchnorr(hashToSign, publicKey, signature);
      if (!isValid) {
        console.log("BITCOIN_INSCRIPTION Invalid Bitcoin BIP322 (P2PKH, P2WPKH, P2TR) signature");
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
  
      //Verify address owns inscriptionID
      const taprootAddress = getTaprootAddressFromPublicKey(publicKey);
      if (debug) console.log('BITCOIN_INSCRIPTION taprootAddress from pubkey: ', taprootAddress);


      // the code in the function given to runOnce below will only be run by one node
      // the result returned will broadcast to all other nodes
      let isOwner = await Lit.Actions.runOnce({ waitForResponse: true, name: "checkUniSat" }, async () => {
        const response = await fetch(`${UNISAT_LIVENET_URI}/v1/indexer/address/${taprootAddress}/inscription-data`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${unisatApiKey}`
            }
        });
      
        if (response.ok) {
            const data = await response.json();
            if (data && data.code === 0 && data.data.inscription.length > 0) {
                const inscriptions = data.data.inscription;
                for (let inscription of inscriptions) {
                    if (inscription.inscriptionId === authSig.inscriptionId) {
                        return "true";
                    }
                }
            }
        }
        return "false";
      });

      //const isOwner = await checkUniSat(taprootAddress, authSig.inscriptionId, UNISAT_LIVENET_URI, unisatApiKey);
      if (isOwner !== "true") {
        console.log("Bitcoin address is not inscriptionID owner:", taprootAddress);
        return Lit.Actions.setResponse({
          response: "false",
          reason: "Bitcoin address is not inscriptionID owner",
        });
      }      
      
      // Checking if user's authMethodId is a permitted Auth Method for pkpTokenId
      const authMethodId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(`inscriptionId:${authSig.inscriptionId}`)
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
        console.log("BITCOIN_INSCRIPTION Bitcoin inscriptionId is not authorized to use this PKP");
        return Lit.Actions.setResponse({
          response: "false",
          reason: "Bitcoin inscriptionId is not authorized to use this PKP",
        });
      }
  
      return Lit.Actions.setResponse({ response: "true" });
    } catch (error) {
      console.log("BITCOIN_INSCRIPTION Error:",error.message);
      return Lit.Actions.setResponse({
        response: "false",
        reason: `Error: ${error.message}`,
      });
    }
})();
