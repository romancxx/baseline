create table public.feeds (
  id            uuid primary key default gen_random_uuid(),
  url           text not null,
  source        text not null,
  macro_bucket  text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index feeds_url_key on public.feeds (url);
create index feeds_macro_bucket_idx on public.feeds (macro_bucket) where active;

create trigger feeds_set_updated_at
  before update on public.feeds
  for each row execute function public.set_updated_at();

alter table public.feeds enable row level security;

create policy "feeds are readable when active"
  on public.feeds for select to authenticated using (active);

grant select on public.feeds to authenticated;

-- A near-duplicate keeps its own row and points at the copy that arrived first, so
-- provenance survives and only the canonical article is ever summarised.
alter table public.articles
  add column canonical_article_id uuid references public.articles (id) on delete set null,
  add column ingested_at timestamptz not null default now();

create index articles_canonical_idx on public.articles (canonical_article_id)
  where canonical_article_id is not null;

-- 384 dimensions: what bge-small-en-v1.5 emits. Free to change while the column is empty;
-- once it holds vectors this becomes a re-embed of the whole corpus.
drop index public.articles_embedding_idx;

alter table public.articles
  alter column embedding type extensions.vector(384);

create index articles_embedding_idx
  on public.articles
  using hnsw (embedding extensions.vector_cosine_ops);
