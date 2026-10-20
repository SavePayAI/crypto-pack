import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { db } from '../../../lib/db.js';
import { requireWallet } from '../../../lib/auth.js';
import { CARDS, PACKS, drawCards } from '../../../lib/shop.js';
import { bad, fail } from '../../../lib/http.js';

// Checks on the blockchain that the buyer really paid the shop wallet.
async function paymentIsValid(sig, wallet, lamports) {
  const conn = new Connection(process.env.SOLANA_RPC, 'confirmed');
  for (let i = 0; i < 6; i++) { // the transaction can take a few seconds to appear
    const tx = await conn.getParsedTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (tx) {
      if (tx.meta?.err) return false;
      if (tx.blockTime && Date.now() / 1000 - tx.blockTime > 600) return false; // older than 10 minutes
      return tx.transaction.message.instructions.some((ix) =>
        ix.program === 'system' && ix.parsed?.type === 'transfer' &&
        ix.parsed.info.source === wallet &&
        ix.parsed.info.destination === process.env.SHOP_WALLET &&
        Number(ix.parsed.info.lamports) >= lamports);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

// Body: { packId, signature }  (signature = the payment transaction signature)
export async function POST(req) {
  try {
    const wallet = requireWallet(req);
    const { packId, signature } = await req.json();
    const pack = PACKS[packId];
    if (!pack || !signature) return bad('Invalid request');
    if (!(await paymentIsValid(signature, wallet, pack.price))) return bad('Payment not found or not valid', 402);

    // Cards are drawn on the server, so players cannot tamper with the result.
    const cards = drawCards(packId).map((k) => ({ key: k, rarity: CARDS[k].rarity, value: CARDS[k].value }));
    const { data, error } = await db.rpc('record_purchase', {
      p_wallet: wallet, p_pack: packId, p_price: pack.price, p_sig: signature, p_cards: cards,
    });
    if (error) {
      if (String(error.message).includes('duplicate')) return bad('This payment was already used', 409);
      throw error;
    }
    return NextResponse.json({ cards: data.map((c) => ({ ...c, name: CARDS[c.card_key].name })) });
  } catch (e) { return fail(e); }
}
