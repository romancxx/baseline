create table public.instruments (
  id            uuid primary key default gen_random_uuid(),
  ticker        text not null,
  isin          text,
  name          text not null,
  type          public.instrument_type not null,
  macro_bucket  text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint instruments_ticker_uppercase check (ticker = upper(ticker)),
  constraint instruments_isin_format check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$')
);

create unique index instruments_ticker_key on public.instruments (ticker);
create unique index instruments_isin_key on public.instruments (isin) where isin is not null;
create index instruments_macro_bucket_idx on public.instruments (macro_bucket) where active;

create trigger instruments_set_updated_at
  before update on public.instruments
  for each row execute function public.set_updated_at();

create table public.portfolio_positions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  instrument_id  uuid not null references public.instruments (id) on delete restrict,
  quantity       numeric(24, 8) not null,
  cost_basis     numeric(24, 8),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint portfolio_positions_quantity_positive check (quantity > 0),
  constraint portfolio_positions_cost_basis_non_negative check (cost_basis is null or cost_basis >= 0),
  constraint portfolio_positions_unique_holding unique (user_id, instrument_id)
);

create index portfolio_positions_instrument_idx on public.portfolio_positions (instrument_id);

create trigger portfolio_positions_set_updated_at
  before update on public.portfolio_positions
  for each row execute function public.set_updated_at();

create table public.watchlist_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  instrument_id  uuid not null references public.instruments (id) on delete restrict,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint watchlist_items_unique_entry unique (user_id, instrument_id)
);

create index watchlist_items_instrument_idx on public.watchlist_items (instrument_id);

create trigger watchlist_items_set_updated_at
  before update on public.watchlist_items
  for each row execute function public.set_updated_at();
