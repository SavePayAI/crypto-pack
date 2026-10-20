import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { db } from '../../../../lib/db.js';
import { loginMessage, signToken } from '../../../../lib/auth.js';
import { bad, fail } from '../../../../lib/http.js';

// Step 2 of login: send the wallet signature (bs58) and get a token.
export async function POST(req) {
  try {
    const { wallet, signature } = await req.json();
    const { data: row } = await db.from('nonces').select().eq('wallet', wallet).maybeSingle();
    if (!row || Date.now() - new Date(row.created_at).getTime() > 5 * 60 * 1000) return bad('Login expired, try again', 401);
    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(loginMessage(row.nonce)),
      bs58.decode(signature),
      bs58.decode(wallet)
    );
    await db.from('nonces').delete().eq('wallet', wallet); // one use only
    if (!ok) return bad('Invalid signature', 401);
    return NextResponse.json({ token: signToken(wallet) });
  } catch (e) { return fail(e); }
}
