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
        description: "AI Webマーケティングをマンガで学ぶメディアサイト",
        founder: { "@id": `${siteUrl}/about#person` },
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/about#person`,
        name: "朱剛明",
        alternateName: ["シュ コウメイ", "Shu Koumei", "Tony Chu Studio"],
        url: `${siteUrl}/representative`,
        jobTitle: "LLMO Consultant & AI Systems Engineer",
        knowsAbout: [
          "LLMO",
          "SEO",
          "AI Agent Development",
          "React",
          "Cloudflare Workers",
          "TypeScript",
        ],
        worksFor: { "@id": `${siteUrl}/#organization` },
        sameAs: [
          "https://www.street-academy.com/steachers/271053",
          "https://coconala.com/users/3983472",
          "https://www.lancers.jp/profile/tony-003",
        ],
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

export function generateAboutJsonLd(siteUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${siteUrl}/about`,
        url: `${siteUrl}/about`,
        name: "サイト概要",
        isPartOf: { "@id": `${siteUrl}/#website` },
        mainEntity: { "@id": `${siteUrl}/about#person` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: "サイト概要",
            item: `${siteUrl}/about`,
          },
        ],
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
        author: { "@id": `${siteUrl}/about#person` },
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
      author: { "@id": `${siteUrl}/about#person` },
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

/** Glossary term shape for JSON-LD generation. */
interface JsonLdGlossaryTerm {
  term: string;
  description: string;
}

/**
 * Generate DefinedTermSet JSON-LD for the /glossary page.
 */
export function generateGlossaryJsonLd(
  terms: JsonLdGlossaryTerm[],
  siteUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${siteUrl}/glossary`,
    name: "AI・Webマーケティング用語集",
    description:
      "AI時代のSEO・LLMO・DXに関する専門用語の定義集。effect.moeのマンガ記事で解説。",
    url: `${siteUrl}/glossary`,
    inLanguage: "ja",
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.description,
      url: `${siteUrl}/glossary#${encodeURIComponent(t.term)}`,
    })),
  };
}

/** FAQ item for article-level FAQ section. */
export interface JsonLdFaq {
  question: string;
  answer: string;
}

/**
 * Generate FAQPage JSON-LD for article-level curated FAQs.
 */
export function generateFaqPageJsonLd(
  faqs: JsonLdFaq[],
  pageUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
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

/**
 * Generate TechArticle + BreadcrumbList JSON-LD for knowledge base articles.
 */
export interface KnowledgeFaq {
  question: string;
  answer: string;
}

export function generateKnowledgeArticleJsonLd(
  article: {
    title: string;
    slug: string;
    description: string | null;
    published_at: string | null;
    cover_image_url: string | null;
    tags: string[];
    reading_time_minutes: number;
    related_manga_slugs: string[];
    related_glossary_terms: string[];
    faqs?: KnowledgeFaq[];
  },
  siteUrl: string,
): object {
  const pageUrl = `${siteUrl}/knowledge/${article.slug}`;
  const graph: object[] = [
    {
      "@type": "TechArticle",
      "@id": pageUrl,
      headline: article.title,
      ...(article.description ? { description: article.description } : {}),
      ...(article.cover_image_url ? { image: article.cover_image_url } : {}),
      ...(article.published_at ? { datePublished: article.published_at } : {}),
      inLanguage: "ja",
      publisher: { "@id": `${siteUrl}/#organization` },
      author: { "@id": `${siteUrl}/about#person` },
      keywords: article.tags.join(", "),
      timeRequired: `PT${article.reading_time_minutes}M`,
      isPartOf: { "@id": `${siteUrl}/knowledge`, "@type": "CollectionPage" },
      ...(article.related_manga_slugs.length > 0
        ? {
            relatedLink: article.related_manga_slugs.map(
              (s) => `${siteUrl}/articles/${s}`,
            ),
          }
        : {}),
      ...(article.related_glossary_terms.length > 0
        ? {
            about: article.related_glossary_terms.map((term) => ({
              "@type": "DefinedTerm",
              name: term,
              inDefinedTermSet: `${siteUrl}/glossary`,
            })),
          }
        : {}),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: "Knowledge Base",
          item: `${siteUrl}/knowledge`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: article.title,
          item: pageUrl,
        },
      ],
    },
  ];

  if (article.faqs && article.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: article.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * Generate Person + BreadcrumbList JSON-LD for the /representative page.
 */
export function generateRepresentativeJsonLd(siteUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${siteUrl}/about#person`,
        name: "朱剛明",
        alternateName: ["シュ コウメイ", "Shu Koumei", "Tony Chu Studio"],
        url: `${siteUrl}/representative`,
        jobTitle: "LLMO Consultant & AI Systems Engineer",
        description:
          "LLMO・Notion・AIシステムの専門家。Web業界18年以上の実務経験を持ち、AI検索時代のWebマーケティング手法を研究・実践。",
        knowsAbout: [
          "LLMO",
          "SEO",
          "AI Agent Development",
          "Notion",
          "React",
          "Cloudflare Workers",
          "TypeScript",
        ],
        alumniOf: {
          "@type": "CollegeOrUniversity",
          name: "北九州大学",
          department: "経済学部",
        },
        worksFor: { "@id": `${siteUrl}/#organization` },
        sameAs: [
          "https://www.street-academy.com/steachers/271053",
          "https://coconala.com/users/3983472",
          "https://www.lancers.jp/profile/tony-003",
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: "About",
            item: `${siteUrl}/about`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "代表者紹介",
            item: `${siteUrl}/representative`,
          },
        ],
      },
    ],
  };
}
