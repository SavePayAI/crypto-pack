# Crypto Pack Backend

Backend untuk toko Crypto Pack: login wallet, cek pembayaran SOL, acak kartu di server,
simpan koleksi, jual kartu (jeda 24 jam, biaya 5%), dan permintaan penarikan saldo.

## Cara pasang (semua gratis untuk percobaan)

1. Buat akun di supabase.com, buat project baru.
2. Di Supabase buka SQL Editor, paste isi `supabase/schema.sql`, klik Run.
3. Di Supabase buka Project Settings > API, salin Project URL dan service_role key.
4. Buat satu wallet Phantom khusus toko (jangan wallet pribadi). Salin alamatnya.
5. Upload folder ini ke GitHub, lalu di vercel.com pilih Add New > Project > pilih repo itu.
6. Di Vercel, isi Environment Variables seperti di `.env.example`
   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOLANA_RPC, SHOP_WALLET, JWT_SECRET). Klik Deploy.

Mulai dengan `SOLANA_RPC=https://api.devnet.solana.com` (SOL percobaan). Pindah ke mainnet
hanya setelah semuanya lolos uji.

## Yang kamu atur sendiri lewat Supabase (Table Editor)

- Tabel `settings`: `buyback_open` (true untuk membuka buyback), `lock_hours` (0 = jual kapan saja), `fee_bps` (500 = 5%), `reserve_bps` (8900 = 89% dari tiap penjualan pack disimpan untuk buyback).
- Tabel `withdrawals`: permintaan tarik saldo dari pemain. Kirim SOL manual dari Phantom, lalu ubah `status` jadi `paid` dan isi `paid_tx`.
- Tabel `pool`: sisa dana cadangan buyback. Kalau nilainya kurang, penjualan kartu otomatis ditolak.

## Daftar API

| Endpoint | Fungsi |
|---|---|
| POST /api/auth/nonce `{wallet}` | minta pesan untuk ditandatangani |
| POST /api/auth/login `{wallet, signature}` | login, dapat token (signature dalam bs58) |
| POST /api/buy `{packId, signature}` | cek pembayaran, acak 5 kartu, simpan |
| GET /api/collection | kartu, saldo, status buyback |
| POST /api/sell `{cardIds}` | jual kartu (aturan dicek di database) |
| POST /api/withdraw `{amountLamports}` | minta tarik saldo |

Semua endpoint kecuali auth memakai header `Authorization: Bearer <token>`.

## Catatan keamanan

- `SUPABASE_SERVICE_ROLE_KEY` dan `JWT_SECRET` hanya boleh ada di Vercel, jangan di kode tampilan.
- Tidak ada private key di server. Pembayaran keluar dilakukan manual oleh kamu.
- Backend ini belum diuji dengan jaringan Solana asli. Uji dulu di devnet.
- Sebelum memakai uang asli, konsultasikan aspek hukumnya (mekanisme pack acak dan buyback bisa dianggap mirip perjudian).
