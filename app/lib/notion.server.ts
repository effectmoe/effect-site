import { Client } from "@notionhq/client";

let notionClient: Client | null = null;

function getNotion(apiKey: string): Client {
  if (!notionClient) {
    notionClient = new Client({ auth: apiKey });
  }
  return notionClient;
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
  const notion = getNotion(env.NOTION_API_KEY);
  const response = await notion.databases.query({
    database_id: env.NOTION_DATABASE_ARTICLES,
    filter: {
      property: "Published",
      checkbox: { equals: true },
    },
    sorts: [{ property: "PublishedAt", direction: "descending" }],
  });

  return response.results.map(pageToArticle);
}

export async function getArticleBySlug(
  env: { NOTION_API_KEY: string; NOTION_DATABASE_ARTICLES: string },
  slug: string,
): Promise<Article | null> {
  const notion = getNotion(env.NOTION_API_KEY);
  const response = await notion.databases.query({
    database_id: env.NOTION_DATABASE_ARTICLES,
    filter: {
      and: [
        { property: "Slug", rich_text: { equals: slug } },
        { property: "Published", checkbox: { equals: true } },
      ],
    },
  });

  if (response.results.length === 0) return null;
  return pageToArticle(response.results[0]);
}

export async function getArticleContent(
  apiKey: string,
  pageId: string,
): Promise<string> {
  const notion = getNotion(apiKey);
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  return blocksToHtml(blocks.results);
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
