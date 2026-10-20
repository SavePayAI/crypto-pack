import jwt from 'jsonwebtoken';
import { bad } from './http.js';

export const loginMessage = (nonce) => `Sign in to Crypto Pack\nNonce: ${nonce}`;
export const signToken = (wallet) => jwt.sign({ wallet }, process.env.JWT_SECRET, { expiresIn: '12h' });

// Returns the logged-in wallet address or throws a 401 response.
export function requireWallet(req) {
  const h = req.headers.get('authorization') || '';
  try {
    return jwt.verify(h.replace('Bearer ', ''), process.env.JWT_SECRET).wallet;
  } catch {
    throw bad('Please sign in with your wallet', 401);
  }
}
