create or replace function public.tx_admin_set_license_status(p_license_id uuid,p_status text)
returns public.tx_licenses language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_license public.tx_licenses%rowtype;
begin
 if auth.uid() is null or (auth.jwt()->'app_metadata'->>'role') <> 'owner_admin' then raise exception 'Owner admin access required' using errcode='42501'; end if;
 if p_status not in ('active','suspended','revoked') then raise exception 'Status must be active, suspended or revoked'; end if;
 select * into v_license from public.tx_licenses where id=p_license_id for update;
 if not found then raise exception 'License not found'; end if;
 if p_status='active' and v_license.expires_at is not null and v_license.expires_at <= now() then
   raise exception 'This license has expired. Verify a renewal payment before reactivating.';
 end if;
 update public.tx_licenses set status=p_status,updated_at=now() where id=p_license_id returning * into v_license;
 insert into public.tx_audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'license_status_changed','license',v_license.id,jsonb_build_object('status',p_status,'customer_id',v_license.customer_id));
 return v_license;
end; $$;
revoke all on function public.tx_admin_set_license_status(uuid,text) from public,anon;
grant execute on function public.tx_admin_set_license_status(uuid,text) to authenticated;