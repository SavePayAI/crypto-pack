import { NextResponse } from 'next/server';
import { db } from '../../../lib/db.js';
import { CARDS, PACKS } from '../../../lib/shop.js';
import { fail } from '../../../lib/http.js';

export const dynamic = 'force-dynamic';

// Public info the shop page needs: wallet to pay, network, packs, cards and shop rules.
export async function GET() {
  try {
    const { data: s } = await db.from('settings').select().eq('id', 1).single();
    return NextResponse.json({
      shopWallet: process.env.SHOP_WALLET,
      rpc: process.env.SOLANA_RPC,
      buybackOpen: s.buyback_open,
      lockHours: s.lock_hours,
      feePercent: s.fee_bps / 100,
      packs: Object.entries(PACKS).map(([id, p]) => ({ id, name: p.name, priceLamports: p.price, odds: p.odds, set: p.set || 'std' })),
      cards: Object.entries(CARDS).map(([key, c]) => ({ key, name: c.name, rarity: c.rarity, valueLamports: c.value, set: c.set || 'std' })),
    });
  } catch (e) { return fail(e); }
}
