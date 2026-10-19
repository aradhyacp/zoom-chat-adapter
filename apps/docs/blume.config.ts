import { defineConfig } from "blume";
import { vercel as vercelAnalytics } from "blume/analytics";
import seoHead from "./integrations/seo-head.mjs";

// design.md substitutes Inter 300 for the licensed Waldenburg Light, so the
// display and body roles share one family and differ only in weight. Both
// roles load the same variant list, which keeps it to a single @font-face set.
const inter = {
  name: "Inter",
  weights: [300, 400, 500, 600],
};

export default defineConfig({
  // Vercel Web Analytics, rendered through the official Astro component Blume
  // injects into every page's <head>. It needs no keys: the script is served
  // first-party from /_vercel/insights, which only exists where Vercel serves
  // the site. Emission is production-only, so local traffic never reaches the
  // dashboard. `vercelAnalytics` is aliased to keep it distinct from the
  // deploy adapter of the same name.
  analytics: [vercelAnalytics()],
  deployment: {
    // Left empty on purpose: Blume fills `site` in from the host's own env
    // (on Vercel, the production domain) and an explicit value would win over
    // that detection. Set DOCS_SITE to pin it — a custom domain, or a local
    // build that needs the sitemap and absolute llms.txt links.
    site: process.env.DOCS_SITE,
  },
  description:
    "Community Zoom Team Chat adapter for Chat SDK — channels, DMs, slash commands, and @-mentions through one Chat interface.",
  footer: {
    copyright: `© ${new Date().getFullYear()} zoom-chat-adapter contributors · MIT`,
    links: [
      { href: "https://www.npmjs.com/package/zoom-chat-adapter", label: "npm" },
      { href: "https://chat-sdk.dev", label: "Chat SDK" },
      { href: "https://marketplace.zoom.us", label: "Zoom Marketplace" },
    ],
    socials: {
      github: "https://github.com/aradhyacp/zoom-chat-adapter",
    },
  },
  github: {
    dir: "apps/docs",
    owner: "aradhyacp",
    repo: "zoom-chat-adapter",
  },
  // Appends the web-app manifest link and the raster favicon links Blume's
  // filename convention can't emit — see integrations/seo-head.mjs.
  integrations: [seoHead()],
  markdown: {
    code: {
      icons: true,
      theme: {
        dark: "github-dark",
        light: "github-light",
      },
    },
  },
  navigation: {
    // The built-in chrome keeps the repository in the footer only; docs readers
    // reach for it from anywhere, so it also sits in the header.
    actions: [
      {
        href: "https://github.com/aradhyacp/zoom-chat-adapter",
        label: "GitHub",
      },
    ],
  },
  seo: {
    // Blume writes the canonical, description, OG, and X-card tags itself.
    // These are the tags it has no setting for, plus the X attribution handle.
    metatags: {
      "og:locale": "en_US",
      "theme-color": "#fdfcfc",
    },
    x: { handle: "@aradhyacp" },
  },
  theme: {
    // Ink pill, not a saturated brand color (design.md: primary #292524).
    accent: { dark: "#fafaf9", light: "#292524" },
    action: "#292524",
    fonts: {
      body: inter,
      display: inter,
      mono: { name: "Geist Mono", weights: [400] },
    },
    mode: "light",
    radius: "md",
  },
  title: "zoom-chat-adapter",
});
