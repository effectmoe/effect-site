/** Minimal article shape used for JSON-LD generation (client-safe). */
interface JsonLdArticle {
  title: string;
  slug: string;
  description: string;
  publishedAt: string | null;
  coverImage: string | null;
  tags: string[];
}

/** Extended article shape for manga/comic JSON-LD. */
interface JsonLdComicIssue extends JsonLdArticle {
  panelCount: number;
  clusterName: string | null;
  clusterSlug: string | null;
  orderInCluster: number;
  readingTimeSeconds?: number;
  transcripts?: string[];
}

/** Cluster shape for ComicSeries JSON-LD. */
interface JsonLdComicSeries {
  name: string;
  slug: string;
  description: string | null;
  issues: {
    title: string;
    slug: string;
    orderInCluster: number;
    coverImage: string | null;
  }[];
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

/**
 * Generate ComicIssue JSON-LD for articles that have manga panels.
 * Falls back to standard Article schema if panelCount is 0.
 */
export function generateComicIssueJsonLd(
  article: JsonLdComicIssue,
  siteUrl: string,
): object {
  const articleUrl = `${siteUrl}/articles/${article.slug}`;
  const graph: object[] = [];

  // Main entity: ComicIssue (when panels exist) or Article (fallback)
  if (article.panelCount > 0) {
    const comicIssue: Record<string, unknown> = {
      "@type": "ComicIssue",
      "@id": articleUrl,
      name: article.title,
      description: article.description,
      datePublished: article.publishedAt,
      issueNumber: article.orderInCluster,
      numberOfPages: article.panelCount,
      author: { "@id": `${siteUrl}/#organization` },
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "ja",
    };

    if (article.coverImage) {
      comicIssue.image = article.coverImage;
    }
    if (article.tags.length > 0) {
      comicIssue.keywords = article.tags.join(", ");
    }
    if (article.clusterSlug) {
      comicIssue.isPartOf = {
        "@id": `${siteUrl}/#series:${article.clusterSlug}`,
      };
    }
    if (article.transcripts && article.transcripts.length > 0) {
      comicIssue.text = article.transcripts.join("\n");
    }

    graph.push(comicIssue);
  } else {
    // Fallback to standard Article
    return generateArticleJsonLd(article, siteUrl);
  }

  // Breadcrumb
  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Articles",
        item: `${siteUrl}/articles`,
      },
      ...(article.clusterName
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: article.clusterName,
              item: `${siteUrl}/articles?cluster=${article.clusterSlug}`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: article.title,
              item: articleUrl,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 3,
              name: article.title,
              item: articleUrl,
            },
          ]),
    ],
  });

  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * Generate ComicSeries JSON-LD for a cluster of articles.
 */
export function generateComicSeriesJsonLd(
  series: JsonLdComicSeries,
  siteUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ComicSeries",
        "@id": `${siteUrl}/#series:${series.slug}`,
        name: series.name,
        ...(series.description
          ? { description: series.description }
          : {}),
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "ja",
        hasPart: series.issues.map((issue) => ({
          "@type": "ComicIssue",
          "@id": `${siteUrl}/articles/${issue.slug}`,
          name: issue.title,
          issueNumber: issue.orderInCluster,
          ...(issue.coverImage ? { image: issue.coverImage } : {}),
        })),
      },
    ],
  };
}
