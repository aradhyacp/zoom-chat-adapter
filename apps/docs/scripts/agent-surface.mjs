/**
 * Checks a built docs site for the surfaces an agent needs, so a regression
 * fails CI instead of turning up in the next readiness audit.
 *
 * Two layers are checked, because they answer different questions:
 *
 * - the files the build emits, under `.vercel/output/static` (a static build
 *   writes the same tree to `dist/`): every page's Markdown twin, the two
 *   error bodies, `llms.txt`, the JSON docs API, and the discovery documents;
 * - the Vercel routing config Blume splices the `Accept: text/markdown`
 *   negotiation into. No file-level check can see a rewrite, and the
 *   negotiation is what an agent requesting a page at its own URL gets.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The build tree this script checks, in the order it looks for one. */
export const SERVED_ROOTS = [".vercel/output/static", "dist"];

/** The Build Output routing config a Vercel server build writes. */
export const VERCEL_CONFIG = ".vercel/output/config.json";

/** Artifacts the docs site promises, as paths under the served root. */
export const REQUIRED_FILES = [
  "404.html",
  "404.json",
  "404.md",
  "agent-readability.json",
  "index.html",
  "index.md",
  "llms-full.txt",
  "llms.txt",
  "openapi.json",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "api/docs/navigation.json",
  "api/docs/pages.json",
  ".well-known/agent-skills/index.json",
  ".well-known/ai-catalog.json",
  ".well-known/api-catalog",
  ".well-known/ard.json",
];

/** Every docs page, by slug, as the sidebar orders them. */
export const CONTENT_PAGES = [
  "index",
  "quickstart",
  "developers",
  "marketplace-setup",
  "configuration",
  "webhooks",
  "messaging",
  "formatting",
  "thread-ids",
  "reference",
  "limitations",
  "troubleshooting",
];

/**
 * A page's two files: the HTML render and the raw-Markdown mirror an agent
 * fetches at `<route>.md` or negotiates for at the route itself.
 */
export const pageFiles = (slug) =>
  slug === "index"
    ? ["index.html", "index.md"]
    : [`${slug}/index.html`, `${slug}.md`];

/** The promised paths absent from a build's file list. */
export const missingFiles = (present) => {
  const have = new Set(present);
  const wanted = [
    ...REQUIRED_FILES,
    ...CONTENT_PAGES.flatMap((slug) => pageFiles(slug)),
  ];
  return wanted.filter((path) => !have.has(path));
};

/**
 * `404.md` has to explain the error and hand the agent somewhere to go: a
 * body under twenty characters, or one with no link out, is a dead end.
 */
const RECOVERY_LINK = /(sitemap|llms\.txt|https?:\/\/)/iu;

export const markdownErrorProblems = (markdown) => {
  const problems = [];
  const body = typeof markdown === "string" ? markdown.trim() : "";
  if (body.length < 20) {
    problems.push(
      `The Markdown 404 body is ${body.length} characters; an agent needs at least 20 to act on it.`
    );
  }
  if (!RECOVERY_LINK.test(body)) {
    problems.push(
      "The Markdown 404 body names no recovery link — a docs, sitemap, or llms.txt URL."
    );
  }
  return problems;
};

/** `404.json` has to be an RFC 9457 problem document an agent can branch on. */
export const problemDocumentProblems = (document) => {
  if (document === null || typeof document !== "object") {
    return ["The JSON 404 body is not a problem document."];
  }
  const problems = [];
  if (document.status !== 404) {
    problems.push("The JSON problem document does not carry status 404.");
  }
  if (!document.code) {
    problems.push(
      "The JSON problem document carries no machine-readable code for an agent to branch on."
    );
  }
  if (String(document.detail ?? "").length < 20) {
    problems.push(
      "The JSON problem document needs a detail an agent can act on."
    );
  }
  if (!document.resolution) {
    problems.push("The JSON problem document needs a resolution hint.");
  }
  return problems;
};

/**
 * The shapes Blume writes into the routing config. Matching the literal
 * `text/markdown` is not enough: the injected rules spell the type out in
 * character classes so the match stays case-insensitive.
 */
const MARKDOWN_ACCEPT =
  /(\[Mm\]\[Aa\]\[Rr\]\[Kk\]\[Dd\]\[Oo\]\[Ww\]\[Nn\]|text\/markdown)/u;
const JSON_ACCEPT = /(\[Jj\]\[Ss\]\[Oo\]\[Nn\]|application\/json)/u;

const routes = (config) => (Array.isArray(config?.routes) ? config.routes : []);

const accepts = (route, pattern) =>
  (Array.isArray(route.has) ? route.has : []).some(
    (condition) =>
      condition.type === "header" &&
      String(condition.key).toLowerCase() === "accept" &&
      pattern.test(String(condition.value ?? ""))
  );

const VARY_ON_ACCEPT = /accept/iu;

const variesOnAccept = (route) =>
  VARY_ON_ACCEPT.test(String(route.headers?.vary ?? ""));

/**
 * The negotiation rules a Vercel server build must carry. Without them the
 * Markdown files exist but nothing serves them at the page's own URL, and a
 * missing page falls back to the HTML shell.
 */
export const routingProblems = (config) => {
  if (config?.version !== 3) {
    return [
      "No Version 3 Build Output config, so Accept: text/markdown negotiation is not wired.",
    ];
  }
  const all = routes(config);
  const problems = [];
  const want = (found, message) => {
    if (!found) {
      problems.push(message);
    }
  };
  want(
    all.some(
      (route) => route.dest === "/index.md" && accepts(route, MARKDOWN_ACCEPT)
    ),
    "No rule serves the homepage as Markdown for Accept: text/markdown."
  );
  want(
    all.some(
      (route) =>
        String(route.dest ?? "").endsWith(".md") &&
        String(route.dest).includes("$1") &&
        accepts(route, MARKDOWN_ACCEPT)
    ),
    "No rule serves a content page's .md mirror for Accept: text/markdown."
  );
  want(
    all.some(variesOnAccept),
    "No rule sets Vary: Accept, so a cache cannot keep the two representations apart."
  );
  want(
    all.some(
      (route) =>
        route.dest === "/404.md" &&
        route.status === 404 &&
        accepts(route, MARKDOWN_ACCEPT)
    ),
    "No rule answers a missing page with the Markdown body and a 404 status."
  );
  want(
    all.some(
      (route) =>
        route.dest === "/404.json" &&
        route.status === 404 &&
        accepts(route, JSON_ACCEPT)
    ),
    "No rule answers a missing page with the JSON problem document and a 404 status."
  );
  return problems;
};

/** Every problem the site has, given a build's files and its error bodies. */
export const audit = ({ present, config, markdown404, problem404 }) => [
  ...missingFiles(present).map((path) => `The build is missing ${path}.`),
  ...routingProblems(config),
  ...markdownErrorProblems(markdown404),
  ...problemDocumentProblems(problem404),
];

const isDirectory = async (path) =>
  (await stat(path).catch(() => null))?.isDirectory() === true;

const walk = async (dir, prefix = "") => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? walk(path, relative) : [relative];
    })
  );
  return nested.flat();
};

const readJson = (path) =>
  readFile(path, "utf8")
    .then((text) => JSON.parse(text))
    .catch(() => null);

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const servedRoot = async () => {
  const candidates = await Promise.all(
    SERVED_ROOTS.map(async (candidate) => {
      const path = join(projectRoot, candidate);
      return (await isDirectory(path)) ? path : null;
    })
  );
  return candidates.find((path) => path !== null) ?? null;
};

const main = async () => {
  const root = await servedRoot();
  if (!root) {
    process.stderr.write(
      `Agent surface: no build output. Run \`blume build\` first — looked for ${SERVED_ROOTS.join(" and ")}.\n`
    );
    process.exitCode = 1;
    return;
  }
  const present = await walk(root);
  const problems = audit({
    config: await readJson(join(projectRoot, VERCEL_CONFIG)),
    markdown404: await readFile(join(root, "404.md"), "utf8").catch(() => null),
    present,
    problem404: await readJson(join(root, "404.json")),
  });
  if (problems.length > 0) {
    process.stderr.write(
      `Agent surface: ${problems.length} problem(s) in ${present.length} built files.\n`
    );
    for (const problem of problems) {
      process.stderr.write(`  - ${problem}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Agent surface: ${present.length} files and the negotiation rules check out.\n`
  );
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
