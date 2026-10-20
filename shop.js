import { randomInt } from 'crypto';

const SOL = 1e9;
const L = (v) => Math.round(v * SOL); // SOL -> lamports (whole numbers avoid rounding errors)

// Server is the single source of truth for cards, values and odds.
export const CARDS = {
  btc:  { name: 'Bitcoin King',     rarity: 'legendary', value: L(0.3) },
  eth:  { name: 'Ether Archmage',   rarity: 'legendary', value: L(0.25) },
  sol:  { name: 'Solana Comet',     rarity: 'epic',      value: L(0.05) },
  bnb:  { name: 'BNB Golden Bull',  rarity: 'epic',      value: L(0.04) },
  avax: { name: 'Avax Summit',      rarity: 'epic',      value: L(0.035) },
  link: { name: 'Chainlink Oracle', rarity: 'rare',      value: L(0.016) },
  ada:  { name: 'Cardano Sage',     rarity: 'rare',      value: L(0.014) },
  dot:  { name: 'Polka Planet',     rarity: 'rare',      value: L(0.013) },
  doge: { name: 'Doge Captain',     rarity: 'common',    value: L(0.005) },
  pepe: { name: 'Pepe Prince',      rarity: 'common',    value: L(0.0042) },
  shib: { name: 'Shiba Flare',      rarity: 'common',    value: L(0.0042) },
  bonk: { name: 'Bonk Hammer',      rarity: 'common',    value: L(0.004) },
};

export const PACKS = {
  basic: { name: 'Basic Pack',   price: L(0.06), odds: { common: 70, rare: 24, epic: 5, legendary: 1 } },
  prem:  { name: 'Premium Pack', price: L(0.2),  odds: { rare: 70, epic: 24, legendary: 6 } },
};

// Cryptographically secure draw. 5 cards per pack.
export function drawCards(packId, n = 5) {
  const odds = PACKS[packId].odds;
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    let roll = randomInt(total), rarity = null;
    for (const [r, w] of Object.entries(odds)) { if (roll < w) { rarity = r; break; } roll -= w; }
    const keys = Object.keys(CARDS).filter((k) => CARDS[k].rarity === rarity);
    out.push(keys[randomInt(keys.length)]);
  }
  return out;
}
