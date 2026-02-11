import type { Route } from "./+types/articles._index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Articles -- effect.moe" }];
}

export default function ArticleList() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Articles</h1>
      <p className="text-gray-500">Coming soon...</p>
    </div>
  );
}
