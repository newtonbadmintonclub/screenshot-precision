create extension if not exists pg_cron;

do $block$
begin
  if exists (select 1 from cron.job where jobname = 'newton-waitlist-expiry') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'newton-waitlist-expiry';
  end if;

  perform cron.schedule(
    'newton-waitlist-expiry',
    '* * * * *',
    'select public.process_waitlist_expirations();'
  );
end;
$block$;
