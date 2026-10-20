import { NextResponse } from 'next/server';
import { db } from '../../../lib/db.js';
import { requireWallet } from '../../../lib/auth.js';
import { CARDS } from '../../../lib/shop.js';
import { fail } from '../../../lib/http.js';

// Returns the player's cards, balance and shop rules (lock, fee, buyback status).
export async function GET(req) {
  try {
    const wallet = requireWallet(req);
    const { data: s } = await db.from('settings').select().eq('id', 1).single();
    const { data: cards } = await db.from('cards')
      .select('id,card_key,rarity,value_lamports,status,acquired_at')
      .eq('wallet', wallet).order('acquired_at', { ascending: false });
    const { data: u } = await db.from('users').select('balance_lamports').eq('wallet', wallet).maybeSingle();
    const now = Date.now();
    return NextResponse.json({
      balanceLamports: u?.balance_lamports ?? 0,
      buybackOpen: s.buyback_open, lockHours: s.lock_hours, feePercent: s.fee_bps / 100,
      cards: (cards || []).map((c) => {
        const unlocksAt = new Date(c.acquired_at).getTime() + s.lock_hours * 3600 * 1000;
        return {
          id: c.id, key: c.card_key, name: CARDS[c.card_key]?.name, rarity: c.rarity, status: c.status,
          valueLamports: c.value_lamports,
          netValueLamports: Math.floor((c.value_lamports * (10000 - s.fee_bps)) / 10000),
          unlocksAt: new Date(unlocksAt).toISOString(),
          sellable: c.status === 'held' && s.buyback_open && now >= unlocksAt,
        };
      }),
    });
  } catch (e) { return fail(e); }
}
