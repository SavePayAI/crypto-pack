import { NextResponse } from 'next/server';
import { db } from '../../../lib/db.js';
import { requireWallet } from '../../../lib/auth.js';
import { bad, fail } from '../../../lib/http.js';

// Body: { cardIds: [...] }. All rules (open/closed, 24h lock, fee, reserve) are checked in the database.
export async function POST(req) {
  try {
    const wallet = requireWallet(req);
    const { cardIds } = await req.json();
    if (!Array.isArray(cardIds) || !cardIds.length || cardIds.length > 50) return bad('Invalid request');
    const { data, error } = await db.rpc('sell_cards', { p_wallet: wallet, p_ids: cardIds });
    if (error) {
      const m = String(error.message);
      if (m.includes('BUYBACK_CLOSED')) return bad('Buyback is not open yet', 403);
      if (m.includes('NOT_SELLABLE')) return bad('Some cards cannot be sold yet (still locked or not yours)', 409);
      if (m.includes('POOL_LOW')) return bad('Buyback reserve is too low right now, please try later', 503);
      throw error;
    }
    return NextResponse.json({ paidLamports: data });
  } catch (e) { return fail(e); }
}
