-- TRADEXO: paid-plan payment verification and license issuance.
-- Uses existing production table names; no customer/payment/license rows are deleted.
alter table public.tx_customers drop constraint if exists tx_customers_plan_check;
alter table public.tx_customers add constraint tx_customers_plan_check
  check (plan in ('basic','starter','business','enterprise'));
alter table public.tx_enquiries drop constraint if exists tx_enquiries_interested_plan_check;
alter table public.tx_enquiries add constraint tx_enquiries_interested_plan_check
  check (interested_plan in ('basic','starter','business','enterprise'));
alter table public.tx_licenses drop constraint if exists tx_licenses_plan_check;
alter table public.tx_licenses add constraint tx_licenses_plan_check
  check (plan in ('basic','starter','business','enterprise'));

create or replace function public.tx_admin_activate_payment(p_payment_id uuid, p_device_limit integer default 1)
returns table(payment_id uuid, license_id uuid, license_key text, plan text, expires_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_payment public.tx_payments%rowtype;
  v_plan text;
  v_license public.tx_licenses%rowtype;
  v_now timestamptz := now();
begin
  if auth.uid() is null or (auth.jwt()->'app_metadata'->>'role') <> 'owner_admin' then
    raise exception 'Owner admin access required' using errcode = '42501';
  end if;
  if p_device_limit is null or p_device_limit < 1 or p_device_limit > 20 then
    raise exception 'Device limit must be between 1 and 20';
  end if;

  select * into v_payment from public.tx_payments
   where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status <> 'pending' then raise exception 'Only pending payments can be activated'; end if;
  if v_payment.customer_id is null then raise exception 'Payment is not linked to a customer'; end if;

  v_plan := case
    when v_payment.amount = 1499 then 'starter'
    when v_payment.amount = 4999 then 'business'
    when v_payment.amount = 9999 then 'enterprise'
    else null end;
  if v_plan is null then
    raise exception 'Payment amount does not match an approved annual TRADEXO plan';
  end if;

  update public.tx_payments
     set status='verified', verified_by=auth.uid(), verified_at=v_now,
         notes=concat_ws(E'\n', nullif(notes,''), 'Verified and license issued by owner admin')
   where id=p_payment_id;

  select * into v_license from public.tx_licenses
   where customer_id=v_payment.customer_id and status='active'
   order by expires_at desc nulls last, created_at desc limit 1 for update;

  if found then
    update public.tx_licenses
       set plan=v_plan,
           expires_at=(greatest(coalesce(v_license.expires_at,v_now),v_now) + interval '1 year'),
           updated_at=v_now
     where id=v_license.id
     returning * into v_license;
  else
    insert into public.tx_licenses(customer_id,plan,status,starts_at,expires_at,activated_by)
    values(v_payment.customer_id,v_plan,'active',v_now,v_now + interval '1 year',auth.uid())
    returning * into v_license;
  end if;

  update public.tx_customers set plan=v_plan, status='active', updated_at=v_now
   where id=v_payment.customer_id;

  insert into public.tx_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'payment_verified_license_activated','license',v_license.id,
    jsonb_build_object('payment_id',p_payment_id,'customer_id',v_payment.customer_id,
      'plan',v_plan,'amount',v_payment.amount,'expires_at',v_license.expires_at));

  return query select v_payment.id,v_license.id,v_license.license_key,v_license.plan,v_license.expires_at;
end;
$$;

create or replace function public.tx_admin_set_license_status(p_license_id uuid, p_status text)
returns public.tx_licenses
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_license public.tx_licenses%rowtype;
begin
  if auth.uid() is null or (auth.jwt()->'app_metadata'->>'role') <> 'owner_admin' then
    raise exception 'Owner admin access required' using errcode = '42501';
  end if;
  if p_status not in ('active','suspended','revoked') then
    raise exception 'Status must be active, suspended or revoked';
  end if;
  update public.tx_licenses set status=p_status, updated_at=now()
   where id=p_license_id returning * into v_license;
  if not found then raise exception 'License not found'; end if;
  insert into public.tx_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'license_status_changed','license',v_license.id,
    jsonb_build_object('status',p_status,'customer_id',v_license.customer_id));
  return v_license;
end;
$$;

revoke all on function public.tx_admin_activate_payment(uuid,integer) from public, anon;
revoke all on function public.tx_admin_set_license_status(uuid,text) from public, anon;
grant execute on function public.tx_admin_activate_payment(uuid,integer) to authenticated;
grant execute on function public.tx_admin_set_license_status(uuid,text) to authenticated;
