create extension if not exists vector with schema extensions;

create type public.instrument_type as enum ('stock', 'etf');
create type public.tonality as enum ('bullish', 'neutral', 'bearish');
create type public.digest_period as enum ('daily', 'weekly');

-- `search_path = ''` blocks search_path hijacking on a function that runs in triggers.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
