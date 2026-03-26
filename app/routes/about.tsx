import { Link } from "react-router";
import type { Route } from "./+types/about";
import {
  getKnowledgeArticles,
  type KnowledgeArticleSummary,
} from "~/lib/d1.server";
import { cached } from "~/lib/cache.server";
import { JsonLd } from "~/components/json-ld";
import { generateAboutJsonLd } from "~/lib/jsonld";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const kbArticles = await cached(env.CACHE, "knowledge:all", () =>
    getKnowledgeArticles(env.DB),
  );
  return { kbArticles, siteUrl: env.SITE_URL };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const siteUrl = loaderData?.siteUrl ?? "";
  return [
    { title: "サイト概要 -- effect.moe" },
    {
      name: "description",
      content:
        "effect.moeの運営者プロフィール。LLMO・SEO・DXに特化したメディアサイトの運営方針と著者情報。",
    },
    {
      tagName: "link" as const,
      rel: "canonical",
      href: `${siteUrl}/about`,
    },
    { property: "og:title", content: "サイト概要 -- effect.moe" },
    {
      property: "og:description",
      content:
        "effect.moeの運営者プロフィール。LLMO・SEO・DXに特化したメディアサイトの運営方針と著者情報。",
    },
    { property: "og:type", content: "profile" },
    { property: "og:url", content: `${siteUrl}/about` },
    { property: "og:site_name", content: "effect.moe" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "サイト概要 -- effect.moe" },
  ];
}

export default function About({ loaderData }: Route.ComponentProps) {
  const { kbArticles, siteUrl } = loaderData;

  return (
    <>
      <JsonLd data={generateAboutJsonLd(siteUrl)} />

      <article className="mx-auto w-full max-w-2xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1 text-xs text-gray-400">
            <li>
              <Link to="/" className="transition-colors hover:text-gray-600">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronIcon />
            </li>
            <li>
              <span className="text-gray-600" aria-current="page">
                サイト概要
              </span>
            </li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            サイト概要
          </h1>
        </header>

        {/* Author Profile */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-gray-900">運営者</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold text-gray-900">
                  Tony Chu Studio
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  AAM (AI Agent Manager) & Multi-Business Owner
                </p>
              </div>
              <Link
                to="/representative"
                className="cursor-pointer rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 transition-all duration-200 hover:border-gray-400 hover:text-gray-900"
              >
                詳しく見る
              </Link>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              AI検索時代のWebマーケティング手法を研究・実践するプロダクトスタジオ。
              LLMO（LLM Optimization）を中心に、AIエージェント開発・マンガコンテンツ制作・SEO/DX最適化を手がける。
              effect.moeでは実際の開発経験をケーススタディとして公開し、実践知を共有している。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "LLMO",
                "SEO",
                "AI Agent",
                "React",
                "Cloudflare Workers",
                "TypeScript",
              ].map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                >
                  {skill}
                </span>
              ))}
            </div>
            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-medium text-gray-500">
                外部プロフィール
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: "ストアカ",
                    href: "https://www.street-academy.com/steachers/271053",
                  },
                  {
                    label: "Amazon著書",
                    href: "https://www.amazon.co.jp/s?k=%E3%82%B0%E3%83%83%E3%83%90%E3%82%A4SEO%E3%80%81%E3%83%8F%E3%83%AD%E3%83%BCLLMO%EF%BC%81%E3%80%9CAI%E6%A4%9C%E7%B4%A2%E6%99%82%E4%BB%A3%E3%81%AEWeb%E3%83%9E%E3%83%BC%E3%82%B1%E3%83%86%E3%82%A3%E3%83%B3%E3%82%B0",
                  },
                  {
                    label: "ココナラ",
                    href: "https://coconala.com/users/3983472",
                  },
                  {
                    label: "ランサーズ",
                    href: "https://www.lancers.jp/profile/tony-003",
                  },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 transition-all duration-200 hover:border-gray-400 hover:text-gray-900"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            effect.moeとは
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-gray-600">
            <p>
              effect.moe は LLMO & DX
              に特化したメディアサイトです。AI検索時代のWebマーケティング手法を研究・発信しています。
            </p>
            <p>
              マンガ形式のビジュアルコンテンツで技術概念をわかりやすく解説し、ナレッジベースのケーススタディで実践的なノウハウを提供します。
              すべてのコンテンツはAIクローラーと人間に同一のHTMLを提供する「クローキング禁止」原則に基づいています。
            </p>
          </div>
        </section>

        {/* 4th Link: Content Hub */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            コンテンツ
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              to="/articles"
              className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-gray-900">
                マンガ記事
              </p>
              <p className="mt-1 text-xs text-gray-500">
                ビジュアルで学ぶ技術解説
              </p>
            </Link>
            <Link
              to="/knowledge"
              className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-gray-900">
                ナレッジ
              </p>
              <p className="mt-1 text-xs text-gray-500">
                実録ケーススタディ
              </p>
            </Link>
            <Link
              to="/glossary"
              className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-gray-900">用語集</p>
              <p className="mt-1 text-xs text-gray-500">
                専門用語の定義
              </p>
            </Link>
          </div>
        </section>

        {/* Recent KB articles by author */}
        {kbArticles.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              著者のケーススタディ
            </h2>
            <ul className="space-y-2">
              {kbArticles.map((kb) => (
                <li key={kb.id}>
                  <Link
                    to={`/knowledge/${kb.slug}`}
                    className="block cursor-pointer rounded-lg border border-gray-100 p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {kb.title}
                    </p>
                    {kb.description && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                        {kb.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}
