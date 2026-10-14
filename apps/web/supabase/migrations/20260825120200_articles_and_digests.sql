create table public.articles (
  id            uuid primary key default gen_random_uuid(),
  url           text not null,
  source        text not null,
  published_at  timestamptz not null,
  title         text not null,
  raw_content   text,
  content_hash  text not null,
  -- Unused in v1; reserved so themes and semantic dedup need no backfill.
  embedding     extensions.vector(1536),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index articles_url_key on public.articles (url);
create unique index articles_content_hash_key on public.articles (content_hash);
create index articles_published_at_idx on public.articles (published_at desc);
create index articles_source_published_at_idx on public.articles (source, published_at desc);
create index articles_embedding_idx
  on public.articles
  using hnsw (embedding extensions.vector_cosine_ops);

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

create table public.article_instruments (
  article_id     uuid not null references public.articles (id) on delete cascade,
  instrument_id  uuid not null references public.instruments (id) on delete cascade,
  confidence     real not null,
  match_method   text not null default 'unknown',
  created_at     timestamptz not null default now(),

  primary key (article_id, instrument_id),
  constraint article_instruments_confidence_range check (confidence >= 0 and confidence <= 1)
);

create index article_instruments_instrument_idx
  on public.article_instruments (instrument_id, created_at desc);

create table public.summaries (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid not null references public.articles (id) on delete cascade,
  model           text not null,
  prompt_version  text not null default 'v1',
  summary_text    text not null,
  tonality        public.tonality not null,
  generated_at    timestamptz not null default now(),

  constraint summaries_unique_generation unique (article_id, model, prompt_version)
);

create index summaries_article_idx on public.summaries (article_id);

create table public.digests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  period        public.digest_period not null,
  period_start  date not null,
  generated_at  timestamptz not null default now(),
  payload       jsonb not null,

  constraint digests_unique_period unique (user_id, period, period_start)
);

create index digests_user_generated_at_idx on public.digests (user_id, generated_at desc);
