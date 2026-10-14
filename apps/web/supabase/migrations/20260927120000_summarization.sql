-- `real` is a 4-byte float: 0.7 is stored as 0.69999998, so `confidence >= 0.7` was false
-- for every row storing 0.7. Summarisation selects articles by exactly that threshold, so
-- the column becomes exact decimal.
alter table public.article_instruments
  alter column confidence type numeric(3, 2);

-- Article bodies arrive as ~260-character teasers, so there is nothing to summarise yet:
-- this phase generates tonality and mentioned tickers, and `summary_text` stays null until
-- full article text is available.
alter table public.summaries
  alter column summary_text drop not null,
  add column confidence numeric(3, 2),
  add column instruments_mentioned text[] not null default '{}',
  add column input_tokens integer,
  add column output_tokens integer;

alter table public.summaries
  add constraint summaries_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1));

-- The hot query: canonical articles with no summary for the current model and prompt.
create index summaries_model_prompt_idx on public.summaries (model, prompt_version);
