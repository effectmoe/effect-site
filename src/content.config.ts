import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({
    base: './src/content/projects',
    pattern: '**/*.{md,mdx}'
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    coverImage: image(),
    tags: z.array(z.string()),
    clientLink: z.url().optional(),
    date: z.coerce.date(),
    client: z.string().optional(),
    featured: z.boolean().default(false),
    icon: z.string().optional(),
  }),
});

const blogs = defineCollection({
  loader: glob({
    base: './src/content/blogs',
    pattern: '**/*.{md,mdx}'
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    heroImage: image(),
    topics: z.array(z.string()),
    pubDate: z.coerce.date(),
    author: z.string(),
    readingTime: z.string(),
    featured: z.boolean().default(false),
  }),
})

const legals = defineCollection({
  loader: glob({
    base: './src/content/legals',
    pattern: '**/*.{md,mdx}'
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { projects, blogs, legals };
