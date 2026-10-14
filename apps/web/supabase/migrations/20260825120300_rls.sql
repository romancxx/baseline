alter table public.instruments enable row level security;
alter table public.articles enable row level security;
alter table public.article_instruments enable row level security;
alter table public.summaries enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.digests enable row level security;

-- Shared tables: readable by signed-in users, written only by the service role,
-- which bypasses RLS. No write policy is the write policy.
create policy "instruments are readable when active"
  on public.instruments for select to authenticated using (active);

create policy "articles are readable"
  on public.articles for select to authenticated using (true);

create policy "article matches are readable"
  on public.article_instruments for select to authenticated using (true);

create policy "summaries are readable"
  on public.summaries for select to authenticated using (true);

-- User-owned tables. `(select auth.uid())` is wrapped so the planner evaluates
-- it once per statement instead of once per row.
create policy "own positions"
  on public.portfolio_positions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own watchlist"
  on public.watchlist_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own digests"
  on public.digests for select to authenticated
  using ((select auth.uid()) = user_id);
