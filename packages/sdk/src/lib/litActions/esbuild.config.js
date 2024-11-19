const esbuild = require('esbuild');

(async () => {
  await esbuild.build({
    entryPoints: [
      './src/lib/litActions/bitcoin/src/authMethodWithBitcoinWallet.js',
      './src/lib/litActions/bitcoin/src/authMethodWithBitcoinInscription.js',
      './src/lib/litActions/bitcoin/src/signInputWithBitcoinEncryptedKey.js',
      './src/lib/litActions/bitcoin/src/signMessageWithBitcoinEncryptedKey.js',
      './src/lib/litActions/bitcoin/src/generateEncryptedBitcoinPrivateKey.js',
    ],
    bundle: true,
    minify: true,
    sourcemap: false,
    outdir: './src/lib/litActions/bitcoin/dist',
    inject: ['./buffer.shim.js'],
    target: ['deno1.0']
  });
  await esbuild.build({
    entryPoints: [
      './src/lib/litActions/solana/src/signTransactionWithSolanaEncryptedKey.js',
      './src/lib/litActions/solana/src/signMessageWithSolanaEncryptedKey.js',
      './src/lib/litActions/solana/src/generateEncryptedSolanaPrivateKey.js',
    ],
    bundle: true,
    minify: true,
    sourcemap: false,
    outdir: './src/lib/litActions/solana/dist',
    inject: ['./buffer.shim.js'],
  });
  await esbuild.build({
    entryPoints: [
      './src/lib/litActions/ethereum/src/signTransactionWithEthereumEncryptedKey.js',
      './src/lib/litActions/ethereum/src/signMessageWithEthereumEncryptedKey.js',
      './src/lib/litActions/ethereum/src/generateEncryptedEthereumPrivateKey.js',
    ],
    bundle: true,
    minify: true,
    sourcemap: false,
    outdir: './src/lib/litActions/ethereum/dist',
    inject: ['./buffer.shim.js'],
  });
  await esbuild.build({
    entryPoints: ['./src/lib/litActions/common/src/exportPrivateKey.js'],
    bundle: true,
    minify: true,
    sourcemap: false,
    outdir: './src/lib/litActions/common/dist',
    inject: ['./buffer.shim.js'],
  });
})();
