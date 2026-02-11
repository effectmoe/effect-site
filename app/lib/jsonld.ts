/** Minimal article shape used for JSON-LD generation (client-safe). */
interface JsonLdArticle {
  title: string;
  slug: string;
  description: string;
  publishedAt: string | null;
  coverImage: string | null;
  tags: string[];
}

const SITE_URL = "https://effect.moe";
const SITE_NAME = "effect.moe";

export function generateSiteJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: "LLMO & DX に特化したメディアサイト",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "ja",
      },
    ],
  };
}

export function generateArticleJsonLd(article: JsonLdArticle): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${SITE_URL}/articles/${article.slug}`,
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        author: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "ja",
        ...(article.coverImage ? { image: article.coverImage } : {}),
        ...(article.tags.length > 0
          ? { keywords: article.tags.join(", ") }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Articles",
            item: `${SITE_URL}/articles`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: `${SITE_URL}/articles/${article.slug}`,
          },
        ],
      },
    ],
  };
}

export function generateArticleListJsonLd(articles: JsonLdArticle[]): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/articles`,
        name: "Articles — effect.moe",
        description: "LLMO & DX に関する記事一覧",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "ja",
      },
      {
        "@type": "ItemList",
        itemListElement: articles.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${SITE_URL}/articles/${article.slug}`,
          name: article.title,
        })),
      },
    ],
  };
}
