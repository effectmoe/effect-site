/** Minimal article shape used for JSON-LD generation (client-safe). */
interface JsonLdArticle {
  title: string;
  slug: string;
  description: string;
  publishedAt: string | null;
  coverImage: string | null;
  tags: string[];
}

export function generateSiteJsonLd(siteUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "effect.moe",
        url: siteUrl,
        description: "LLMO & DX に特化したメディアサイト",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "effect.moe",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "ja",
      },
    ],
  };
}

export function generateArticleJsonLd(
  article: JsonLdArticle,
  siteUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${siteUrl}/articles/${article.slug}`,
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        author: { "@id": `${siteUrl}/#organization` },
        publisher: { "@id": `${siteUrl}/#organization` },
        isPartOf: { "@id": `${siteUrl}/#website` },
        inLanguage: "ja",
        ...(article.coverImage ? { image: article.coverImage } : {}),
        ...(article.tags.length > 0
          ? { keywords: article.tags.join(", ") }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: "Articles",
            item: `${siteUrl}/articles`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: `${siteUrl}/articles/${article.slug}`,
          },
        ],
      },
    ],
  };
}

export function generateArticleListJsonLd(
  articles: JsonLdArticle[],
  siteUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/articles`,
        name: "Articles — effect.moe",
        description: "LLMO & DX に関する記事一覧",
        isPartOf: { "@id": `${siteUrl}/#website` },
        inLanguage: "ja",
      },
      {
        "@type": "ItemList",
        itemListElement: articles.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${siteUrl}/articles/${article.slug}`,
          name: article.title,
        })),
      },
    ],
  };
}
