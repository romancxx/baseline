-- Tables created by the CLI's migration role do not pick up Supabase's default
-- privileges, so the API roles get nothing until granted. RLS still decides which
-- rows; these grants only decide which verbs are reachable at all.
grant usage on schema public to anon, authenticated, service_role;

grant select on
  public.instruments,
  public.articles,
  public.article_instruments,
  public.summaries,
  public.digests
to authenticated;

grant select, insert, update, delete on
  public.portfolio_positions
to authenticated;

grant all on all tables in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
