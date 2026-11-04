-- Safe, idempotent sync RPCs for the offline-first desktop client.
-- Clients must call these functions with their authenticated Supabase session.
-- A batch is atomic: any invalid event rejects the whole batch.

create or replace function public.tx_push_sync_events(
  p_tenant_id uuid,
  p_device_id uuid,
  p_events jsonb
)
returns table(accepted_count integer, duplicate_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event jsonb;
  v_rows integer;
  v_accepted integer := 0;
  v_duplicates integer := 0;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) < 1
     or jsonb_array_length(p_events) > 200 then
    raise exception 'Events must be an array containing 1 to 200 items'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.tx_tenants t
    join public.tx_tenant_members m on m.tenant_id = t.id
    where t.id = p_tenant_id
      and t.status = 'active'
      and m.user_id = v_uid
      and m.role in ('owner', 'admin', 'staff')
  ) then
    raise exception 'Tenant access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tx_devices d
    where d.id = p_device_id
      and d.tenant_id = p_tenant_id
      and d.auth_user_id = v_uid
      and d.status = 'active'
  ) then
    raise exception 'Device is not registered or is inactive'
      using errcode = '42501';
  end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    if jsonb_typeof(v_event) <> 'object'
       or nullif(v_event->>'event_id', '') is null
       or nullif(v_event->>'entity_type', '') is null
       or nullif(v_event->>'entity_id', '') is null
       or nullif(v_event->>'operation', '') is null
       or jsonb_typeof(v_event->'payload') <> 'object'
       or nullif(v_event->>'client_created_at', '') is null then
      raise exception 'Each event must include event_id, entity_type, entity_id, operation, object payload and client_created_at'
        using errcode = '22023';
    end if;

    if length(v_event->>'entity_type') > 80
       or length(v_event->>'entity_id') > 160
       or octet_length((v_event->'payload')::text) > 262144
       or coalesce((v_event->>'schema_version')::integer, 1) < 1 then
      raise exception 'Event field or payload exceeds supported limits'
        using errcode = '22023';
    end if;

    if v_event->>'operation' not in ('create', 'update', 'reverse', 'archive') then
      raise exception 'Unsupported event operation'
        using errcode = '22023';
    end if;

    insert into public.tx_sync_events (
      event_id, tenant_id, device_id, entity_type, entity_id,
      operation, payload, schema_version, client_created_at
    ) values (
      (v_event->>'event_id')::uuid,
      p_tenant_id,
      p_device_id,
      v_event->>'entity_type',
      v_event->>'entity_id',
      v_event->>'operation',
      v_event->'payload',
      coalesce((v_event->>'schema_version')::integer, 1),
      (v_event->>'client_created_at')::timestamptz
    )
    on conflict (event_id) do nothing;

    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      v_accepted := v_accepted + 1;
    else
      v_duplicates := v_duplicates + 1;
    end if;
  end loop;

  return query select v_accepted, v_duplicates;
end;
$$;

create or replace function public.tx_pull_sync_events(
  p_tenant_id uuid,
  p_device_id uuid,
  p_after_received_at timestamptz default null,
  p_after_event_id uuid default null,
  p_limit integer default 200
)
returns table(
  event_id uuid,
  entity_type text,
  entity_id text,
  operation text,
  payload jsonb,
  schema_version integer,
  client_created_at timestamptz,
  server_received_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if (p_after_received_at is null) <> (p_after_event_id is null) then
    raise exception 'Both cursor values must be supplied together'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.tx_tenants t
    join public.tx_tenant_members m on m.tenant_id = t.id
    where t.id = p_tenant_id
      and t.status = 'active'
      and m.user_id = v_uid
      and m.role in ('owner', 'admin', 'staff', 'viewer')
  ) then
    raise exception 'Tenant access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tx_devices d
    where d.id = p_device_id
      and d.tenant_id = p_tenant_id
      and d.auth_user_id = v_uid
      and d.status = 'active'
  ) then
    raise exception 'Device is not registered or is inactive'
      using errcode = '42501';
  end if;

  return query
  select e.event_id, e.entity_type, e.entity_id, e.operation,
         e.payload, e.schema_version, e.client_created_at,
         e.server_received_at
  from public.tx_sync_events e
  where e.tenant_id = p_tenant_id
    and (p_after_received_at is null
         or (e.server_received_at, e.event_id) > (p_after_received_at, p_after_event_id))
  order by e.server_received_at, e.event_id
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

revoke all on function public.tx_push_sync_events(uuid, uuid, jsonb) from public, anon;
revoke all on function public.tx_pull_sync_events(uuid, uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.tx_push_sync_events(uuid, uuid, jsonb) to authenticated;
grant execute on function public.tx_pull_sync_events(uuid, uuid, timestamptz, uuid, integer) to authenticated;
