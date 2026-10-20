import { NextResponse } from 'next/server';
import { db } from '../../../lib/db.js';
import { requireWallet } from '../../../lib/auth.js';
import { bad, fail } from '../../../lib/http.js';

// Body: { amountLamports }. Creates a pending request. The shop owner pays it manually
// (so no private key ever lives on the server) and marks it paid in Supabase.
export async function POST(req) {
  try {
    const wallet = requireWallet(req);
    const { amountLamports } = await req.json();
    if (!Number.isInteger(amountLamports) || amountLamports <= 0) return bad('Invalid amount');
    const { error } = await db.rpc('request_withdrawal', { p_wallet: wallet, p_amount: amountLamports });
    if (error) {
      if (String(error.message).includes('NO_BALANCE')) return bad('Not enough balance', 409);
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
