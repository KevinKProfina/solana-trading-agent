import { getWalletStatus } from './wallet.js';

const cfg = {
  solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY ?? '',
  rpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  minRequiredSol: Number(process.env.MIN_SOL_BALANCE ?? '0.1'),
};

const status = await getWalletStatus(cfg.solanaPrivateKey, cfg.rpcUrl, cfg.minRequiredSol);
console.log(JSON.stringify(status, null, 2));
