import type { Route } from "./+types/_index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "effect.moe -- LLMO & DX Media" },
    { name: "description", content: "AI時代のWebマーケティングを再定義する LLMO & DX メディア" },
  ];
}

export default function Index() {
  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">effect.moe</h1>
      <p className="text-lg text-gray-600">
        LLMO (Large Language Model Optimization) & DX に特化したメディアサイト
      </p>
    </div>
  );
}
