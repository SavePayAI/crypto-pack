import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// Optional automatic payouts from a SMALL dedicated "payout wallet".
// Only works when PAYOUT_KEY (base58 secret key of that wallet) is set in Vercel.
export const payoutEnabled = () => !!process.env.PAYOUT_KEY;

// Payouts bigger than this stay pending for manual review (default 0.5 SOL).
export const AUTO_CAP = Math.round(parseFloat(process.env.AUTO_PAYOUT_MAX_SOL || '0.5') * 1e9);

export async function sendPayout(toWallet, lamports) {
  const kp = Keypair.fromSecretKey(bs58.decode(process.env.PAYOUT_KEY));
  const conn = new Connection(process.env.SOLANA_RPC, 'confirmed');
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(toWallet), lamports })
  );
  return await sendAndConfirmTransaction(conn, tx, [kp]);
}
