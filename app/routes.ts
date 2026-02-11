import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("articles", "routes/articles._index.tsx"),
  route("articles/:slug", "routes/articles.$slug.tsx"),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
