import type { ClusterWithArticles } from "~/lib/d1.server";
import { ArticleCard } from "./article-card";

interface ClusterSectionProps {
  cluster: ClusterWithArticles;
  readSlugs?: Set<string>;
}

export function ClusterSection({
  cluster,
  readSlugs,
}: ClusterSectionProps) {
  return (
    <section id={`cluster-${cluster.slug}`} className="scroll-mt-20">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {cluster.name}
        </h2>
        {cluster.description && (
          <p className="mt-1 text-sm text-gray-500">
            {cluster.description}
          </p>
        )}
      </div>

      {cluster.articles.length === 0 ? (
        <p className="text-sm text-gray-400">Coming soon</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {cluster.articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              seriesNumber={article.order_in_cluster}
              isRead={readSlugs?.has(article.slug)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
