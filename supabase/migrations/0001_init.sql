create table if not exists page_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  session_id text,
  referrer text,
  webgpu_available boolean,
  vram_gb numeric,
  created_at timestamptz not null default now()
);

alter table page_visits enable row level security;
drop policy if exists "page_visits_v1_read" on page_visits;
create policy "page_visits_v1_read" on page_visits for select using (true);
drop policy if exists "page_visits_v1_write" on page_visits;
create policy "page_visits_v1_write" on page_visits for all using (true) with check (true);

create table if not exists purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  session_id text,
  price_cents integer not null default 2900,
  cta_label text,
  created_at timestamptz not null default now()
);

alter table purchase_intents enable row level security;
drop policy if exists "purchase_intents_v1_read" on purchase_intents;
create policy "purchase_intents_v1_read" on purchase_intents for select using (true);
drop policy if exists "purchase_intents_v1_write" on purchase_intents;
create policy "purchase_intents_v1_write" on purchase_intents for all using (true) with check (true);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  buyer_email text,
  amount_cents integer not null,
  currency text not null default 'usd',
  payment_provider text not null default 'stripe',
  payment_provider_id text,
  status text not null default 'completed',
  access_token text,
  created_at timestamptz not null default now()
);

alter table purchases enable row level security;
drop policy if exists "purchases_v1_read" on purchases;
create policy "purchases_v1_read" on purchases for select using (true);
drop policy if exists "purchases_v1_write" on purchases;
create policy "purchases_v1_write" on purchases for all using (true) with check (true);

insert into purchases (id, buyer_email, amount_cents, currency, payment_provider, payment_provider_id, status, access_token) values
  (gen_random_uuid(), 'demo.buyer1@example.com', 2900, 'usd', 'stripe', 'pi_demo_001', 'completed', 'tok_demo_001'),
  (gen_random_uuid(), 'demo.buyer2@example.com', 2900, 'usd', 'stripe', 'pi_demo_002', 'completed', 'tok_demo_002'),
  (gen_random_uuid(), 'demo.buyer3@example.com', 2900, 'usd', 'lemon_squeezy', 'ls_demo_003', 'completed', 'tok_demo_003');

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  purchase_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table activities enable row level security;
drop policy if exists "activities_v1_read" on activities;
create policy "activities_v1_read" on activities for select using (true);
drop policy if exists "activities_v1_write" on activities;
create policy "activities_v1_write" on activities for all using (true) with check (true);