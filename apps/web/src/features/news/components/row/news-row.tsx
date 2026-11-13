import { formatDate, formatTime } from "@/shared/format";
import type { Article } from "@/types/news";

export type NewsRowProps = {
  readonly article: Article;
};

export function NewsRow({ article }: NewsRowProps) {
  return (
    <li className="flex flex-col gap-0.5 border-hairline border-b py-2.5 last:border-b-0">
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="text-body text-primary hover:underline"
      >
        {article.title}
      </a>
      <p className="font-mono text-meta text-tertiary uppercase">
        <span className="font-semibold text-secondary">{article.publisher}</span>{" "}
        <time dateTime={article.publishedAt}>
          {formatDate(article.publishedAt, "day")} · {formatTime(article.publishedAt)}
        </time>
      </p>
    </li>
  );
}
