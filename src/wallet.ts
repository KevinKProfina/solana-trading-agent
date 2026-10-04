import fs from 'node:fs/promises';
import path from 'node:path';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

export type WalletStatus = {
  ok: boolean;
  solBalance: number;
  lamports: number;
  publicKey: string;
  minRequiredSol: number;
  message: string;
};

export async function getWalletStatus(
  solanaPrivateKey: string,
  rpcUrl: string,
  minRequiredSol: number,
): Promise<WalletStatus> {
  const keypair = Keypair.fromSecretKey(bs58.decode(solanaPrivateKey));
  const connection = new Connection(rpcUrl);
  const balanceLamports = await connection.getBalance(keypair.publicKey);
  const solBalance = balanceLamports / LAMPORTS_PER_SOL;

  const ok = solBalance >= minRequiredSol;
  return {
    ok,
    solBalance,
    lamports: balanceLamports,
    publicKey: keypair.publicKey.toBase58(),
    minRequiredSol,
    message: ok
      ? `Wallet is funded (${solBalance.toFixed(4)} SOL available)`
      : `Wallet is underfunded (${solBalance.toFixed(4)} SOL < ${minRequiredSol} SOL minimum)`,
  };
}

export async function ensureWalletHealth(
  solanaPrivateKey: string,
  rpcUrl: string,
  minRequiredSol: number,
) {
  const status = await getWalletStatus(solanaPrivateKey, rpcUrl, minRequiredSol);
  if (!status.ok) {
    throw new Error(status.message);
  }

  return status;
}

export async function saveJsonFile(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    await saveJsonFile(filePath, fallback);
    return fallback;
  }
}
