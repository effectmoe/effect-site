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

const articles = defineCollection({
  loader: glob({
    base: './src/content/articles',
    pattern: '**/*.{md,mdx}'
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    domain: z.string().optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const knowledge = defineCollection({
  loader: glob({
    base: './src/content/knowledge',
    pattern: '**/*.{md,mdx}'
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    domain: z.string().optional(),
    heroImage: z.string().optional(),
    sources: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, blogs, legals, articles, knowledge };
