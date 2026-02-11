const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  coverImage: string | null;
}

export async function getArticles(env: {
  NOTION_API_KEY: string;
  NOTION_DATABASE_ARTICLES: string;
}): Promise<Article[]> {
  const res = await fetch(
    `${NOTION_API_BASE}/databases/${env.NOTION_DATABASE_ARTICLES}/query`,
    {
      method: "POST",
      headers: headers(env.NOTION_API_KEY),
      body: JSON.stringify({
        filter: {
          property: "Published",
          checkbox: { equals: true },
        },
        sorts: [{ property: "PublishedAt", direction: "descending" }],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Notion API error (getArticles):", res.status, text);
    return [];
  }

  const data = (await res.json()) as { results: unknown[] };
  return data.results.map(pageToArticle);
}

export async function getArticleBySlug(
  env: { NOTION_API_KEY: string; NOTION_DATABASE_ARTICLES: string },
  slug: string,
): Promise<Article | null> {
  const res = await fetch(
    `${NOTION_API_BASE}/databases/${env.NOTION_DATABASE_ARTICLES}/query`,
    {
      method: "POST",
      headers: headers(env.NOTION_API_KEY),
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Slug", rich_text: { equals: slug } },
            { property: "Published", checkbox: { equals: true } },
          ],
        },
      }),
    },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as { results: unknown[] };
  if (data.results.length === 0) return null;
  return pageToArticle(data.results[0]);
}

export async function getArticleContent(
  apiKey: string,
  pageId: string,
): Promise<string> {
  const res = await fetch(
    `${NOTION_API_BASE}/blocks/${pageId}/children?page_size=100`,
    {
      method: "GET",
      headers: headers(apiKey),
    },
  );

  if (!res.ok) return "<p>Failed to load article content.</p>";

  const data = (await res.json()) as { results: unknown[] };
  return blocksToHtml(data.results);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToArticle(page: any): Article {
  const props = page.properties;
  return {
    id: page.id,
    title: props.Title?.title?.[0]?.plain_text ?? "",
    slug: props.Slug?.rich_text?.[0]?.plain_text ?? "",
    description: props.Description?.rich_text?.[0]?.plain_text ?? "",
    category: props.Category?.select?.name ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: props.Tags?.multi_select?.map((t: any) => t.name) ?? [],
    published: props.Published?.checkbox ?? false,
    publishedAt: props.PublishedAt?.date?.start ?? null,
    coverImage: props.CoverImage?.url ?? null,
  };
}

/**
 * Convert Notion blocks to plain text for RAG indexing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function blocksToPlainText(blocks: any[]): string {
  return blocks
    .map((block) => {
      const type = block.type;
      switch (type) {
        case "paragraph":
          return richTextToPlain(block.paragraph.rich_text);
        case "heading_1":
          return richTextToPlain(block.heading_1.rich_text);
        case "heading_2":
          return richTextToPlain(block.heading_2.rich_text);
        case "heading_3":
          return richTextToPlain(block.heading_3.rich_text);
        case "bulleted_list_item":
          return richTextToPlain(block.bulleted_list_item.rich_text);
        case "numbered_list_item":
          return richTextToPlain(block.numbered_list_item.rich_text);
        case "code":
          return richTextToPlain(block.code.rich_text);
        case "quote":
          return richTextToPlain(block.quote.rich_text);
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function richTextToPlain(richText: any[]): string {
  if (!richText?.length) return "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return richText.map((rt: any) => rt.plain_text).join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blocksToHtml(blocks: any[]): string {
  return blocks.map(blockToHtml).filter(Boolean).join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blockToHtml(block: any): string {
  const type = block.type;
  switch (type) {
    case "paragraph":
      return `<p>${richTextToHtml(block.paragraph.rich_text)}</p>`;
    case "heading_1":
      return `<h1>${richTextToHtml(block.heading_1.rich_text)}</h1>`;
    case "heading_2":
      return `<h2>${richTextToHtml(block.heading_2.rich_text)}</h2>`;
    case "heading_3":
      return `<h3>${richTextToHtml(block.heading_3.rich_text)}</h3>`;
    case "bulleted_list_item":
      return `<li>${richTextToHtml(block.bulleted_list_item.rich_text)}</li>`;
    case "numbered_list_item":
      return `<li>${richTextToHtml(block.numbered_list_item.rich_text)}</li>`;
    case "code":
      return `<pre><code class="language-${block.code.language}">${richTextToHtml(block.code.rich_text)}</code></pre>`;
    case "quote":
      return `<blockquote>${richTextToHtml(block.quote.rich_text)}</blockquote>`;
    case "divider":
      return "<hr />";
    case "image": {
      const url =
        block.image.file?.url ?? block.image.external?.url ?? "";
      const caption = block.image.caption?.[0]?.plain_text ?? "";
      return `<figure><img src="${url}" alt="${caption}" loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
    }
    default:
      return "";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function richTextToHtml(richText: any[]): string {
  if (!richText?.length) return "";
  return richText
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((rt: any) => {
      let text: string = rt.plain_text;
      if (rt.annotations.bold) text = `<strong>${text}</strong>`;
      if (rt.annotations.italic) text = `<em>${text}</em>`;
      if (rt.annotations.code) text = `<code>${text}</code>`;
      if (rt.annotations.strikethrough) text = `<s>${text}</s>`;
      if (rt.href) text = `<a href="${rt.href}">${text}</a>`;
      return text;
    })
    .join("");
}
