import { NextResponse } from 'next/server';
import { db } from '../../../lib/db.js';
import { requireWallet } from '../../../lib/auth.js';
import { payoutEnabled, sendPayout, AUTO_CAP } from '../../../lib/payout.js';
import { bad, fail } from '../../../lib/http.js';

// Body: { cardIds: [...] }. All rules (open/closed, lock, fee, reserve) are checked in the database.
// After a sale, the proceeds become a payout to the seller's wallet. If a payout wallet is configured
// and the amount is under the cap, it is sent automatically. Otherwise it stays pending for manual payment.
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
    const net = Number(data);

    // Turn the credit into a payout request (moves it out of the in-shop balance).
    const { error: wErr } = await db.rpc('request_withdrawal', { p_wallet: wallet, p_amount: net });
    if (wErr) throw wErr;

    let payout = 'pending', tx = null;
    if (payoutEnabled() && net <= AUTO_CAP) {
      const { data: rows } = await db.from('withdrawals').select('id')
        .eq('wallet', wallet).eq('status', 'pending').eq('amount_lamports', net)
        .order('created_at', { ascending: false }).limit(1);
      try {
        tx = await sendPayout(wallet, net);
        payout = 'sent';
      } catch (e) {
        console.error('auto payout failed, left pending', e);
      }
      if (payout === 'sent' && rows && rows[0]) {
        try { await db.from('withdrawals').update({ status: 'paid', paid_tx: tx }).eq('id', rows[0].id); }
        catch (e) { console.error('could not mark payout paid', tx, e); }
      }
    }
    return NextResponse.json({ paidLamports: net, payout, tx });
  } catch (e) { return fail(e); }
}
