import type { Route } from "./+types/articles.$slug";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Article: ${params.slug} -- effect.moe` }];
}

export default function ArticleDetail({ params }: Route.ComponentProps) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Article: {params.slug}</h1>
      <p className="text-gray-500">Content loading...</p>
    </div>
  );
}
