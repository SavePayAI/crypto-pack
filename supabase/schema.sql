-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run.

create table settings (
  id int primary key default 1 check (id = 1),
  buyback_open boolean not null default false,   -- you switch this to true when ready
  lock_hours int not null default 24,            -- set to 0 for sell any time
  fee_bps int not null default 500,              -- 500 = 5% sell fee
  reserve_bps int not null default 8900          -- 89% of every pack sale goes to the buyback reserve
);
insert into settings default values;

create table pool (id int primary key default 1 check (id = 1), lamports bigint not null default 0);
insert into pool default values;

create table users (wallet text primary key, balance_lamports bigint not null default 0, created_at timestamptz default now());
create table nonces (wallet text primary key, nonce text not null, created_at timestamptz default now());

create table purchases (
  id uuid primary key default gen_random_uuid(),
  wallet text not null references users(wallet),
  pack_id text not null, price_lamports bigint not null,
  tx_signature text not null unique,             -- a payment can only be used once
  created_at timestamptz default now()
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  wallet text not null references users(wallet),
  purchase_id uuid references purchases(id),
  card_key text not null, rarity text not null, value_lamports bigint not null,
  status text not null default 'held' check (status in ('held','sold')),
  acquired_at timestamptz not null default now(), sold_at timestamptz
);

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  wallet text not null, amount_lamports bigint not null,
  status text not null default 'pending',        -- change to 'paid' after you send the SOL
  paid_tx text, created_at timestamptz default now()
);

-- Only the server (service role key) can touch the data. The browser can never read these tables directly.
alter table settings enable row level security;
alter table pool enable row level security;
alter table users enable row level security;
alter table nonces enable row level security;
alter table purchases enable row level security;
alter table cards enable row level security;
alter table withdrawals enable row level security;

create or replace function record_purchase(p_wallet text, p_pack text, p_price bigint, p_sig text, p_cards jsonb)
returns jsonb language plpgsql as $$
declare s settings%rowtype; pid uuid; res jsonb;
begin
  select * into s from settings where id = 1;
  insert into users(wallet) values (p_wallet) on conflict do nothing;
  insert into purchases(wallet, pack_id, price_lamports, tx_signature) values (p_wallet, p_pack, p_price, p_sig) returning id into pid;
  with ins as (
    insert into cards(wallet, purchase_id, card_key, rarity, value_lamports)
    select p_wallet, pid, c->>'key', c->>'rarity', (c->>'value')::bigint from jsonb_array_elements(p_cards) c
    returning id, card_key, rarity, value_lamports
  ) select jsonb_agg(to_jsonb(ins)) into res from ins;
  update pool set lamports = lamports + (p_price * s.reserve_bps / 10000) where id = 1;
  return res;
end $$;

create or replace function sell_cards(p_wallet text, p_ids uuid[])
returns bigint language plpgsql as $$
declare s settings%rowtype; n int; gross bigint; net bigint; reserve bigint;
begin
  select * into s from settings where id = 1;
  if not s.buyback_open then raise exception 'BUYBACK_CLOSED'; end if;
  perform 1 from cards where id = any(p_ids) for update;  -- block double selling
  select count(*), coalesce(sum(value_lamports), 0) into n, gross from cards
    where id = any(p_ids) and wallet = p_wallet and status = 'held'
      and acquired_at <= now() - make_interval(hours => s.lock_hours);
  if n <> cardinality(p_ids) then raise exception 'NOT_SELLABLE'; end if;
  net := gross * (10000 - s.fee_bps) / 10000;
  select lamports into reserve from pool where id = 1 for update;
  if reserve < net then raise exception 'POOL_LOW'; end if;
  update pool set lamports = lamports - net where id = 1;
  update cards set status = 'sold', sold_at = now() where id = any(p_ids);
  update users set balance_lamports = balance_lamports + net where wallet = p_wallet;
  return net;
end $$;

create or replace function request_withdrawal(p_wallet text, p_amount bigint)
returns void language plpgsql as $$
begin
  update users set balance_lamports = balance_lamports - p_amount where wallet = p_wallet and balance_lamports >= p_amount;
  if not found then raise exception 'NO_BALANCE'; end if;
  insert into withdrawals(wallet, amount_lamports) values (p_wallet, p_amount);
end $$;
