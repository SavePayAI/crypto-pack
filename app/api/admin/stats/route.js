import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db.js';
import { requireWallet } from '../../../../lib/auth.js';
import { bad, fail } from '../../../../lib/http.js';

export const dynamic = 'force-dynamic';

const L = 1e9;
const sol = (n) => Number(n || 0) / L;

// Supabase returns at most 1000 rows per request, so read tables page by page.
async function all(table, cols, orderBy) {
  const out = [];
  for (let from = 0; from < 50000; from += 1000) {
    let q = db.from(table).select(cols).range(from, from + 999);
    if (orderBy) q = q.order(orderBy, { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Dashboard numbers. Only the admin wallet (ADMIN_WALLET, or the shop wallet by default) can read this.
export async function GET(req) {
  try {
    const wallet = requireWallet(req);
    const admin = process.env.ADMIN_WALLET || process.env.SHOP_WALLET;
    if (wallet !== admin) return bad('This wallet is not the shop admin wallet', 403);

    const { data: pool } = await db.from('pool').select('lamports').eq('id', 1).single();
    const { data: s } = await db.from('settings').select().eq('id', 1).single();
    const users = await all('users', 'wallet,balance_lamports');
    const purchases = await all('purchases', 'wallet,pack_id,price_lamports,created_at', 'created_at');
    const cards = await all('cards', 'wallet,status,value_lamports');
    const wd = await all('withdrawals', 'wallet,amount_lamports,status,created_at,paid_tx', 'created_at');

    const byWallet = {}, byPack = {};
    const W = (w) => byWallet[w] || (byWallet[w] = { wallet: w, buys: 0, spent: 0, held: 0, sold: 0, payouts: 0, paid: 0 });
    let revenue = 0, soldGross = 0, soldCount = 0, paidOut = 0, paidCount = 0, pending = 0, pendingCount = 0, wdAll = 0;

    for (const p of purchases) {
      const v = Number(p.price_lamports);
      revenue += v;
      const x = W(p.wallet); x.buys++; x.spent += v;
      const k = byPack[p.pack_id] || (byPack[p.pack_id] = { pack: p.pack_id, count: 0, volume: 0 });
      k.count++; k.volume += v;
    }
    for (const c of cards) {
      const x = W(c.wallet);
      if (c.status === 'held') x.held++;
      else { x.sold++; soldCount++; soldGross += Number(c.value_lamports); }
    }
    for (const w of wd) {
      const v = Number(w.amount_lamports);
      const x = W(w.wallet); x.payouts++;
      wdAll += v;
      if (w.status === 'paid') { paidOut += v; paidCount++; x.paid += v; }
      else { pending += v; pendingCount++; }
    }
    const owed = users.reduce((a, u) => a + Number(u.balance_lamports), 0);
    const reserve = Number(pool?.lamports || 0);
    const feeEst = (soldGross * s.fee_bps) / 10000;
    // Money you may take = revenue - already paid out - everything the shop still has to keep.
    const safeProfit = revenue - paidOut - (reserve + pending + owed);

    const recent = [
      ...purchases.slice(0, 40).map((p) => ({ time: p.created_at, type: 'Buy', wallet: p.wallet, detail: p.pack_id, amount: sol(p.price_lamports), status: 'confirmed' })),
      ...wd.slice(0, 40).map((w) => ({ time: w.created_at, type: 'Payout', wallet: w.wallet, detail: w.paid_tx || '', amount: sol(w.amount_lamports), status: w.status })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 40);

    return NextResponse.json({
      feePercent: s.fee_bps / 100,
      totals: {
        reserve: sol(reserve), revenue: sol(revenue), purchaseCount: purchases.length,
        soldCount, soldGross: sol(soldGross), feeEst: sol(feeEst),
        paidOut: sol(paidOut), paidCount, pending: sol(pending), pendingCount,
        owed: sol(owed), txCount: purchases.length + wd.length, volume: sol(revenue + wdAll),
        safeProfit: sol(safeProfit),
      },
      packs: Object.values(byPack).map((k) => ({ ...k, volume: sol(k.volume) })).sort((a, b) => b.volume - a.volume),
      wallets: Object.values(byWallet).map((x) => ({ ...x, spent: sol(x.spent), paid: sol(x.paid) })).sort((a, b) => b.spent - a.spent),
      recent,
    });
  } catch (e) { return fail(e); }
}
