import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },

  // Cron trigger: warm KV cache every 5 minutes to eliminate cold starts
  async scheduled(event, env, ctx) {
    const url = env.SITE_URL || "https://effect-site.effectmoe.workers.dev";
    ctx.waitUntil(fetch(`${url}/`).catch(() => {}));
  },
} satisfies ExportedHandler<Env>;
