export function meta() {
  return [
    { title: "About -- effect.moe" },
    { name: "description", content: "effect.moeについて" },
  ];
}

export default function About() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">About</h1>
      <p className="text-gray-600">
        effect.moe は LLMO & DX に特化したメディアサイトです。
        AI検索時代のWebマーケティング手法を研究・発信しています。
      </p>
    </div>
  );
}
