-- Process due investment maturities independently of Vercel deployment/cron limits.
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'quantix-investment-maturities-every-minute'
  ) then
    perform cron.schedule(
      'quantix-investment-maturities-every-minute',
      '* * * * *',
      $$select public.process_maturity_atomic(id)
        from public.quantix_investments
        where status = 'ACTIVE'
          and matures_at <= now();$$
    );
  end if;
end
$$;
