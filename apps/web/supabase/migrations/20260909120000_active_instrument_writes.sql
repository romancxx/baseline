-- Foreign keys are checked without RLS, so an inactive instrument was still referenceable
-- by a hand-made request. Splitting the blanket `for all` policy is what lets INSERT carry
-- a stricter condition than UPDATE: a position whose instrument is later deactivated must
-- stay editable.

drop policy "own positions" on public.portfolio_positions;

create policy "read own positions"
  on public.portfolio_positions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "add own positions"
  on public.portfolio_positions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.instruments i where i.id = instrument_id and i.active
    )
  );

create policy "edit own positions"
  on public.portfolio_positions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "remove own positions"
  on public.portfolio_positions for delete to authenticated
  using ((select auth.uid()) = user_id);
