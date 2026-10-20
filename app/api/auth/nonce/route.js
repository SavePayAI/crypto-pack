import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '../../../../lib/db.js';
import { loginMessage } from '../../../../lib/auth.js';
import { bad, fail } from '../../../../lib/http.js';

// Step 1 of login: ask for a one-time message to sign.
export async function POST(req) {
  try {
    const { wallet } = await req.json();
    if (!wallet || wallet.length > 64) return bad('Invalid wallet');
    const nonce = randomBytes(16).toString('hex');
    const { error } = await db.from('nonces').upsert({ wallet, nonce, created_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ message: loginMessage(nonce) });
  } catch (e) { return fail(e); }
}
