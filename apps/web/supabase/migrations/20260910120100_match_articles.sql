-- Nearest neighbours by cosine distance. Exposed as an RPC because PostgREST cannot
-- express the `<=>` operator, and only the ingest job (service_role) ever calls it.
create function public.match_articles(
  query_embedding extensions.vector(384),
  since timestamptz,
  match_count integer default 5
)
returns table (id uuid, distance real)
language sql
stable
set search_path = ''
as $$
  select a.id, (a.embedding operator(extensions.<=>) query_embedding)::real as distance
  from public.articles a
  where a.embedding is not null
    and a.published_at >= since
    and a.canonical_article_id is null
  order by a.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

revoke execute on function public.match_articles(extensions.vector, timestamptz, integer)
  from public, anon, authenticated;

grant execute on function public.match_articles(extensions.vector, timestamptz, integer)
  to service_role;
