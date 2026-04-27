// @ts-check
import { defineConfig, fontProviders, passthroughImageService } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

import cloudflare from '@astrojs/cloudflare';

import icon from 'astro-icon';

import mdx from "@astrojs/mdx";

const siteUrl = process.env.SITE || 'https://effect.moe';

export default defineConfig({
  devToolbar: {
    enabled: false
  },

  image: {
    service: passthroughImageService()
  },

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['gsap']
    }
  },

  integrations: [sitemap(), icon(), mdx()],
  site: siteUrl,
  output: 'static',

  fonts: [
    {
      provider: fontProviders.local(),
      name: "Clash-Display",
      cssVariable: "--font-clash-display",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            weight: 700,
            style: "normal",
            display: "swap",
            src: ["./src/assets/fonts/ClashDisplay-Bold.woff2"]
          }
        ]
      }
    },
    {
      provider: fontProviders.local(),
      name: "Roboto-Mono",
      cssVariable: "--font-roboto-mono",
      fallbacks: ["ui-sans-serif"],
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            display: "swap",
            src: ["./src/assets/fonts/RobotoMono-Regular.woff2"]
          }
        ]
      }
    },
    {
      provider: fontProviders.local(),
      name: "Space-Grotesk",
      cssVariable: "--font-space-grotesk",
      fallbacks: ["monospace"],
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            display: "swap",
            src: ["./src/assets/fonts/space-grotesk-latin-400-normal.woff2"]
          }
        ]
      }
    },
    {
      provider: fontProviders.google(),
      name: "Zen Kaku Gothic New",
      cssVariable: "--font-zen-kaku",
      fallbacks: ["sans-serif"],
      weights: [400, 500, 700],
      display: "swap",
      subsets: ["japanese", "latin"]
    }
  ]
});
