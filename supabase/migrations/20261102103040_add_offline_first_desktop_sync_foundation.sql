create table if not exists public.tx_tenants (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.tx_tenant_members (
  tenant_id uuid not null references public.tx_tenants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null default 'owner' check (role in ('owner','admin','staff','viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create table if not exists public.tx_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tx_tenants(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  device_fingerprint_hash text not null,
  device_label text not null default 'Windows PC',
  app_version text,
  last_seen_at timestamptz,
  status text not null default 'active' check (status in ('active','revoked','blocked')),
  created_at timestamptz not null default now(),
  unique (tenant_id, device_fingerprint_hash)
);
create table if not exists public.tx_sync_events (
  event_id uuid primary key,
  tenant_id uuid not null references public.tx_tenants(id) on delete restrict,
  device_id uuid not null references public.tx_devices(id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('create','update','reverse','archive')),
  payload jsonb not null,
  schema_version integer not null default 1 check (schema_version > 0),
  client_created_at timestamptz not null,
  server_received_at timestamptz not null default now()
);
create index if not exists tx_sync_events_tenant_received_idx on public.tx_sync_events (tenant_id, server_received_at, event_id);
create index if not exists tx_sync_events_device_received_idx on public.tx_sync_events (device_id, server_received_at);
create table if not exists public.tx_device_cursors (
  device_id uuid not null references public.tx_devices(id) on delete restrict,
  tenant_id uuid not null references public.tx_tenants(id) on delete restrict,
  last_received_at timestamptz,
  last_event_id uuid,
  updated_at timestamptz not null default now(),
  primary key (device_id, tenant_id)
);
create table if not exists public.tx_license_devices (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.tx_licenses(id) on delete restrict,
  device_id uuid not null references public.tx_devices(id) on delete restrict,
  activated_at timestamptz not null default now(),
  last_validated_at timestamptz,
  offline_until timestamptz,
  status text not null default 'active' check (status in ('active','revoked')),
  unique (license_id, device_id)
);
create table if not exists public.tx_releases (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'stable' check (channel in ('stable','beta')),
  version text not null,
  platform text not null default 'win32-x64',
  download_url text not null,
  release_notes text not null default '',
  mandatory boolean not null default false,
  min_supported_version text,
  published_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (channel, version, platform)
);
alter table public.tx_tenants enable row level security;
alter table public.tx_tenant_members enable row level security;
alter table public.tx_devices enable row level security;
alter table public.tx_sync_events enable row level security;
alter table public.tx_device_cursors enable row level security;
alter table public.tx_license_devices enable row level security;
alter table public.tx_releases enable row level security;
create policy "Members can read their own membership" on public.tx_tenant_members for select to authenticated using (user_id = (select auth.uid()));
create policy "Tenant members can read tenant profile" on public.tx_tenants for select to authenticated using (owner_user_id = (select auth.uid()) or exists (select 1 from public.tx_tenant_members m where m.tenant_id = tx_tenants.id and m.user_id = (select auth.uid())));
create policy "Tenant members can read devices" on public.tx_devices for select to authenticated using (exists (select 1 from public.tx_tenant_members m where m.tenant_id = tx_devices.tenant_id and m.user_id = (select auth.uid())));
create policy "Registered devices can append sync events" on public.tx_sync_events for insert to authenticated with check (exists (select 1 from public.tx_tenant_members m where m.tenant_id = tx_sync_events.tenant_id and m.user_id = (select auth.uid())) and exists (select 1 from public.tx_devices d where d.id = tx_sync_events.device_id and d.tenant_id = tx_sync_events.tenant_id and d.auth_user_id = (select auth.uid()) and d.status = 'active'));
create policy "Tenant members can read sync events" on public.tx_sync_events for select to authenticated using (exists (select 1 from public.tx_tenant_members m where m.tenant_id = tx_sync_events.tenant_id and m.user_id = (select auth.uid())));
create policy "Users can read their device cursors" on public.tx_device_cursors for select to authenticated using (exists (select 1 from public.tx_devices d where d.id = tx_device_cursors.device_id and d.auth_user_id = (select auth.uid())));
create policy "License owners can read device activations" on public.tx_license_devices for select to authenticated using (exists (select 1 from public.tx_licenses l join public.tx_customers c on c.id = l.customer_id where l.id = tx_license_devices.license_id and c.email = ((select auth.jwt()) ->> 'email')));
create policy "Anyone can read active desktop release metadata" on public.tx_releases for select to anon, authenticated using (is_active = true);
revoke all on public.tx_tenants, public.tx_tenant_members, public.tx_devices, public.tx_sync_events, public.tx_device_cursors, public.tx_license_devices, public.tx_releases from anon;
grant select on public.tx_tenants, public.tx_tenant_members, public.tx_devices, public.tx_sync_events, public.tx_device_cursors, public.tx_license_devices to authenticated;
grant insert on public.tx_sync_events to authenticated;
grant select on public.tx_releases to anon, authenticated;
