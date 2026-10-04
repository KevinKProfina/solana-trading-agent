import { getWalletStatus } from './wallet.js';

const amount = Number(process.env.MIN_SOL_BALANCE ?? '0.1');
const status = await getWalletStatus(process.env.SOLANA_PRIVATE_KEY ?? '', process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com', amount);
console.log(JSON.stringify(status, null, 2));
