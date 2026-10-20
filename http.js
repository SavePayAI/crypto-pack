import { NextResponse } from 'next/server';
export const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });
export function fail(e) {
  if (e instanceof Response) return e;
  console.error(e);
  return bad('Server error', 500);
}
