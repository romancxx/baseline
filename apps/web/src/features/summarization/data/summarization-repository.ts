import {
  type ArticleToSummarize,
  ArticleToSummarizeSchema,
  type SummaryRecord,
} from "@/features/summarization/schemas/summary.schema";
import { createSupabaseAdminClient } from "@/shared/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export function summarizationClient(): Admin {
  return createSupabaseAdminClient();
}

export type PendingQuery = {
  readonly model: string;
  readonly promptVersion: string;
  readonly minConfidence: number;
  readonly limit: number;
};

/**
 * Canonical articles carrying at least one link of `minConfidence`, that have no summary for
 * this exact (model, prompt_version). Near-duplicates are excluded because their canonical
 * copy is the one worth spending a request on.
 */
export async function findArticlesToSummarize(
  db: Admin,
  query: PendingQuery,
): Promise<ArticleToSummarize[]> {
  const { data: alreadyDone, error: doneError } = await db
    .from("summaries")
    .select("article_id")
    .eq("model", query.model)
    .eq("prompt_version", query.promptVersion);

  if (doneError) throw new Error(`Could not list existing summaries: ${doneError.message}`);

  const done = new Set(alreadyDone.map((row) => row.article_id));

  const { data, error } = await db
    .from("articles")
    .select("id, title, source, raw_content, article_instruments!inner(confidence)")
    .is("canonical_article_id", null)
    .gte("article_instruments.confidence", query.minConfidence)
    .order("published_at", { ascending: false })
    // Over-fetch, because the already-summarised rows are filtered client-side: PostgREST
    // cannot express "not in this subquery" without a view.
    .limit(query.limit + done.size);

  if (error) throw new Error(`Could not list articles to summarise: ${error.message}`);

  return data
    .filter((row) => !done.has(row.id))
    .slice(0, query.limit)
    .map((row) =>
      ArticleToSummarizeSchema.parse({
        id: row.id,
        title: row.title,
        source: row.source,
        body: row.raw_content,
      }),
    );
}

export async function insertSummary(db: Admin, record: SummaryRecord): Promise<boolean> {
  const { data, error } = await db
    .from("summaries")
    .upsert(
      {
        article_id: record.articleId,
        model: record.model,
        prompt_version: record.promptVersion,
        summary_text: null,
        tonality: record.tonality,
        confidence: record.confidence,
        instruments_mentioned: [...record.instrumentsMentioned],
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
      },
      { onConflict: "article_id,model,prompt_version", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not store summary: ${error.message}`);

  return data !== null;
}
