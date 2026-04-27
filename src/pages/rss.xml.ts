import { t } from "@/lib/utils";
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async ({ site }) => {
  const blog = await getCollection("blogs");

  return rss({
    title: t('rss.title'),
    description: t('rss.description'),
    site: site ?? '',
    stylesheet: '/rss/styles.xsl',
    items: blog.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}`,
    })),
  });
}
