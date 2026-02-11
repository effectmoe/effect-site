import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("articles", "routes/articles._index.tsx"),
  route("articles/:slug", "routes/articles.$slug.tsx"),
  route("about", "routes/about.tsx"),
  route("api/crawler-stats", "routes/api.crawler-stats.ts"),
  route("llms.txt", "routes/llms[.]txt.ts"),
  route("robots.txt", "routes/robots[.]txt.ts"),
  route("sitemap.xml", "routes/sitemap[.]xml.ts"),
] satisfies RouteConfig;
