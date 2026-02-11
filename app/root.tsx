import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import { ChatWidget } from "~/components/chat-widget";
import { aiCrawlerMiddleware } from "~/lib/middleware.server";
import { JsonLd } from "~/components/json-ld";
import { generateSiteJsonLd } from "~/lib/jsonld";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const extraHeaders = await aiCrawlerMiddleware(request, env);
  return data({ siteUrl: env.SITE_URL }, { headers: extraHeaders });
}

export function Layout({ children }: { children: React.ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let siteUrl = "https://effect.moe";
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const loaderData = useLoaderData<typeof loader>();
    if (loaderData?.siteUrl) siteUrl = loaderData.siteUrl;
  } catch {
    // ErrorBoundary may not have loader data
  }

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <JsonLd data={generateSiteJsonLd(siteUrl)} />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="mx-auto max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
        <Footer />
        <ChatWidget />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div className="pt-16 p-4 container mx-auto">
      <h1 className="text-4xl font-bold mb-4">{message}</h1>
      <p className="text-gray-600 mb-8">{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto bg-gray-100 rounded text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </div>
  );
}
