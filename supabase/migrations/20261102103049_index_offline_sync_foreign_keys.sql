create index if not exists tx_tenants_owner_user_idx on public.tx_tenants(owner_user_id);
create index if not exists tx_tenant_members_user_idx on public.tx_tenant_members(user_id);
create index if not exists tx_devices_auth_user_idx on public.tx_devices(auth_user_id);
create index if not exists tx_device_cursors_tenant_idx on public.tx_device_cursors(tenant_id);
create index if not exists tx_license_devices_device_idx on public.tx_license_devices(device_id);