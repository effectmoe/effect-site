import type { CollectionEntry } from 'astro:content';

type RelatedItem = CollectionEntry<'projects'> | CollectionEntry<'blogs'>;

export function getRelatedItems<T extends RelatedItem>(items: T[], currentIndex: number): T[] {
  if (items.length <= 1) return [];

  const total = items.length;
  const nextIndex = (currentIndex + 1) % total;
  const prevIndex = (currentIndex - 1 + total) % total;

  const related: T[] = [];

  if (nextIndex !== currentIndex) related.push(items[nextIndex]);
  if (prevIndex !== currentIndex && related.length < 2) related.push(items[prevIndex]);

  return related;
}
