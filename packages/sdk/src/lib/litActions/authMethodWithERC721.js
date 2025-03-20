// @ts-nocheck

(async () => {

    const LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS = {
        'datil': "0x213Db6E1446928E19588269bEF7dFc9187c4829A",
        'datil-test': "0x60C1ddC8b9e38F730F0e7B70A2F84C1A98A69167",
        'datil-dev': "0xf64638F1eb3b064f5443F7c9e2Dc050ed535D891"
    };
    // Define method type and interface
    const ERC721_AUTH_METHOD_TYPE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("ERC721_V0_4")
    );
    const IS_PERMITTED_AUTH_METHOD_INTERFACE = new ethers.utils.Interface([
        "function isPermittedAuthMethod(uint256 tokenId, uint256 authMethodType, bytes memory id) public view returns (bool)",
    ]);

    console.log("ERC721 authSig:", accessToken);
    console.log("ERC721 network:", network);

    try {
        // Parse the authSig object from the request
        const authSig = JSON.parse(accessToken);
        const permissionsContract = network ? LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS[network] : LIT_PKP_PERMISSIONS_CONTRACT_ADDRESS['datil-dev'];

        // Verify Ethereum signature
        const recoveredAddr = ethers.utils.verifyMessage(authSig.signedMessage, authSig.sig);
        const isValid = recoveredAddr.toLowerCase() === authSig.address.toLowerCase();

        if (!isValid) {
            console.log("Invalid Ethereum signature");
            return Lit.Actions.setResponse({
                response: "false",
                reason: "Invalid Ethereum signature",
            });
        }

        const expirationTime = authSig.signedMessage.split('Expiration Time: ')[1].split('\n')[0];
        const isRecent = Date.now() / 1000 < new Date(expirationTime);
        if (!isRecent) {
            console.log("Authenticated Ethereum signature expired");
            return Lit.Actions.setResponse({
                response: "false",
                reason: "Authenticated Ethereum signature expired",
            });
        }

        // Extract chainId from authSig
        const chainId = authSig.chainId;
        if (!chainId) {
            throw new Error("Missing chainId in authSig");
        }

        // Determine the appropriate RPC URL
        // Predefined RPC URLs (with multiple options per chain)
        const supportedRpcUrls = {
            core: [
                "https://rpc.coredao.org",
                "https://1rpc.io/core",
                "https://rpc-core.icecreamswap.com",
            ],
            bob: [
                "https://rpc.gobob.xyz/",
                "https://bob-mainnet.public.blastapi.io",
            ],
            bitlayer: [
                "https://rpc.bitlayer.org",
                "https://rpc.bitlayer-rpc.com",
                "https://rpc.ankr.com/bitlayer",
            ]
        };

        const chainRpcUrls = supportedRpcUrls[chainId];
        if (!chainRpcUrls || chainRpcUrls.length === 0) {
            throw new Error(`No RPC URLs found for chainId ${chainId}`);
        }

        // Randomly select an RPC URL from the available options
        const rpcUrl = chainRpcUrls[Math.floor(Math.random() * chainRpcUrls.length)];

        // Initialize ethers provider
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Parameters for ERC721 verification
        const contractAddress = authSig.contractAddress;
        const tokenId = authSig.tokenId;
        const ethereumAddress = authSig.address;

        // ERC721 ABI
        const ERC721_ABI = [
            "function ownerOf(uint256 tokenId) view returns (address)",
        ];

        // Initialize the contract instance
        const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

        // Verify Ethereum address owns the tokenId
        const ownerAddress = await contract.ownerOf(tokenId);

        // Compare the owner address with the provided address
        const isOwner = ownerAddress.toLowerCase() === ethereumAddress.toLowerCase();

        // Check the result of the runOnce block
        if (!isOwner) {
            console.log(`Ethereum address does not own tokenId ${authSig.tokenId}`);
            return Lit.Actions.setResponse({
                response: "false",
                reason: `Ethereum address does not own tokenId ${authSig.tokenId}`,
            });
        }

        // Authorization check
        const authMethodId = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes(
                `erc721:${authSig.chainId}:${authSig.contractAddress}:${authSig.tokenId}`
            )
        );

        const abiEncodedData = IS_PERMITTED_AUTH_METHOD_INTERFACE.encodeFunctionData(
            "isPermittedAuthMethod",
            [pkpTokenId, ERC721_AUTH_METHOD_TYPE, authMethodId]
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
            console.log("ERC721 address is not authorized to use this PKP");
            return Lit.Actions.setResponse({
                response: "false",
                reason: "ERC721 address is not authorized to use this PKP",
            });
        }

        // Final response if all checks pass
        return Lit.Actions.setResponse({ response: "true" });
    } catch (error) {
        console.log("Error:", error.message);
        return Lit.Actions.setResponse({
            response: "false",
            reason: `Error: ${error.message}`,
        });
    }
})();
