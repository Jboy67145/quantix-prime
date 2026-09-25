-- Keep withdrawal policy at the requested current minimum.
update public.quantix_withdrawal_settings
set minimum_minor = 100000,
    updated_at = now()
where id = (
  select id from public.quantix_withdrawal_settings
  order by updated_at desc nulls last
  limit 1
);
