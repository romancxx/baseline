import { createHash } from "node:crypto";
import type { NormalizedArticle, RawArticle } from "@/features/ingestion/schemas/ingestion.schema";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ");
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function cleanText(value: string): string {
  return collapseWhitespace(stripHtml(value));
}

/**
 * The hash decides whether two articles are the same story, so it must ignore what
 * syndication changes: casing, punctuation and whitespace. It must not ignore the words.
 */
export function contentHash(title: string, content: string | null): string {
  const canonical = [title, content ?? ""]
    .map((part) => cleanText(part).toLowerCase())
    .join("\n")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return createHash("sha256").update(canonical).digest("hex");
}

const EMBEDDING_INPUT_LIMIT = 2000;

export function buildEmbeddingInput(title: string, content: string | null): string {
  const body = content === null ? "" : cleanText(content);
  return `${cleanText(title)}\n\n${body}`.slice(0, EMBEDDING_INPUT_LIMIT).trim();
}

export function normalizeArticle(article: RawArticle): NormalizedArticle {
  const title = cleanText(article.title);
  const rawContent = article.rawContent === null ? null : cleanText(article.rawContent);

  return {
    ...article,
    title,
    rawContent,
    contentHash: contentHash(title, rawContent),
    embeddingInput: buildEmbeddingInput(title, rawContent),
  };
}
