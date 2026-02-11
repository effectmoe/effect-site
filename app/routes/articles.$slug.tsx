import { data } from "react-router";
import type { Route } from "./+types/articles.$slug";
import { getArticleBySlug, getArticleContent } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";
import { JsonLd } from "~/components/json-ld";
import { generateArticleJsonLd } from "~/lib/jsonld";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const slug = params.slug;

  const article = await cached(env.CACHE, `article:${slug}`, () =>
    getArticleBySlug(env, slug),
  );

  if (!article) {
    throw data(null, { status: 404 });
  }

  const content = await cached(
    env.CACHE,
    `article-content:${article.id}`,
    () => getArticleContent(env.NOTION_API_KEY, article.id),
    600,
  );

  return { article, content };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found -- effect.moe" }];
  const { article } = loaderData;
  return [
    { title: `${article.title} -- effect.moe` },
    { name: "description", content: article.description },
    { property: "og:title", content: article.title },
    { property: "og:description", content: article.description },
    { property: "og:type", content: "article" },
    ...(article.coverImage
      ? [{ property: "og:image", content: article.coverImage }]
      : []),
  ];
}

export default function ArticleDetail({ loaderData }: Route.ComponentProps) {
  const { article, content } = loaderData;

  return (
    <>
      <JsonLd data={generateArticleJsonLd(article)} />
      <article className="mx-auto max-w-3xl">
      <header className="mb-8">
        {article.category && (
          <span className="text-sm font-medium uppercase tracking-wide text-blue-600">
            {article.category}
          </span>
        )}
        <h1 className="mt-2 text-3xl font-bold">{article.title}</h1>
        {article.publishedAt && (
          <time className="mt-2 block text-sm text-gray-400">
            {new Date(article.publishedAt).toLocaleDateString("ja-JP")}
          </time>
        )}
        {article.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>
      <div
        className="prose prose-gray max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </article>
    </>
  );
}
