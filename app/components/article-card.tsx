import { Link } from "react-router";
import type { ArticleSummary } from "~/lib/d1.server";

interface ArticleCardProps {
  article: ArticleSummary;
  seriesNumber: number;
  isRead?: boolean;
}

export function ArticleCard({
  article,
  seriesNumber,
  isRead = false,
}: ArticleCardProps) {
  return (
    <Link
      to={`/articles/${article.slug}`}
      className="group block"
      prefetch="intent"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-sm border border-gray-200 bg-gray-50">
        {article.cover_image_url ? (
          <img
            src={article.cover_image_url}
            alt={article.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 ease-in-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-100">
            <span className="text-xs text-gray-400">No cover</span>
          </div>
        )}

        {/* Series number badge */}
        <span className="absolute left-1.5 top-1.5 rounded-sm bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
          #{seriesNumber}
        </span>

        {/* Read indicator */}
        {isRead && (
          <div className="absolute inset-0 bg-gray-900/30" />
        )}

        {/* Panel count */}
        {article.panel_count > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-white/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gray-700">
            {article.panel_count}p
          </span>
        )}
      </div>

      <div className="mt-1.5 px-0.5">
        <h3 className="text-sm font-medium leading-tight text-gray-900 group-hover:text-gray-600">
          {article.title}
        </h3>
        {article.category && (
          <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-gray-400">
            {article.category}
          </span>
        )}
      </div>
    </Link>
  );
}
