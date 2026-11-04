-- TRADEXO website admin data foundation.
-- Owner access is derived only from trusted Supabase app_metadata, never user-editable metadata.
create extension if not exists pgcrypto;

create table if not exists public.tx_enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_code text unique,
  name text not null,
  mobile text not null,
  business text,
  requested_plan text not null default 'Basic',
  message text,
  status text not null default 'new' check (status in ('new','contacted','converted','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.tx_customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  name text not null,
  email text,
  mobile text,
  business_name text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tx_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.tx_customers(id) on delete restrict,
  amount_paise bigint not null check (amount_paise >= 0),
  currency text not null default 'INR',
  plan_code text not null check (plan_code in ('basic','starter','business','enterprise')),
  payment_reference text,
  status text not null default 'pending' check (status in ('pending','verified','rejected','refunded')),
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tx_licenses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.tx_customers(id) on delete restrict,
  license_key_hash text not null unique,
  plan_code text not null check (plan_code in ('basic','starter','business','enterprise')),
  status text not null default 'pending' check (status in ('pending','active','suspended','expired','revoked')),
  starts_at timestamptz,
  expires_at timestamptz,
  device_limit integer not null default 1 check (device_limit between 1 and 20),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tx_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tx_enquiries_created_at_idx on public.tx_enquiries(created_at desc);
create index if not exists tx_customers_created_at_idx on public.tx_customers(created_at desc);
create index if not exists tx_payments_created_at_idx on public.tx_payments(created_at desc);
create index if not exists tx_licenses_created_at_idx on public.tx_licenses(created_at desc);
create index if not exists tx_audit_logs_created_at_idx on public.tx_audit_logs(created_at desc);

alter table public.tx_enquiries enable row level security;
alter table public.tx_customers enable row level security;
alter table public.tx_payments enable row level security;
alter table public.tx_licenses enable row level security;
alter table public.tx_audit_logs enable row level security;

-- Public website can submit an enquiry only; it cannot read, edit or delete enquiries.
drop policy if exists "Public can submit TRADEXO enquiries" on public.tx_enquiries;
create policy "Public can submit TRADEXO enquiries"
  on public.tx_enquiries for insert to anon, authenticated
  with check (status = 'new');

-- Owner Admin can read operational records. No delete policies are provided.
do $$
declare t text;
begin
  foreach t in array array['tx_enquiries','tx_customers','tx_payments','tx_licenses','tx_audit_logs']
  loop
    execute format('drop policy if exists %I on public.%I', 'Owner admin read '||t, t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''role'') = ''owner_admin'')',
      'Owner admin read '||t, t
    );
  end loop;
end $$;

grant select on public.tx_enquiries, public.tx_customers, public.tx_payments, public.tx_licenses, public.tx_audit_logs to authenticated;
grant insert on public.tx_enquiries to anon, authenticated;
