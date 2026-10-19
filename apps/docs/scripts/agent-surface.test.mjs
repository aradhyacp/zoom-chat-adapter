import { describe, expect, it } from "vitest";
import {
  audit,
  CONTENT_PAGES,
  markdownErrorProblems,
  missingFiles,
  pageFiles,
  problemDocumentProblems,
  REQUIRED_FILES,
  routingProblems,
} from "./agent-surface.mjs";

// The shape Blume injects: the type spelled out as character classes so the
// match stays case-insensitive, and Markdown excluded from the JSON rules.
const MARKDOWN_ACCEPT =
  "^(?:.*,)?\\s*[Tt][Ee][Xx][Tt]/[Mm][Aa][Rr][Kk][Dd][Oo][Ww][Nn]$";
const JSON_ACCEPT =
  "^[Aa][Pp][Pp][Ll][Ii][Cc][Aa][Tt][Ii][Oo][Nn]/[Jj][Ss][Oo][Nn]$";

const completeBuild = [
  ...REQUIRED_FILES,
  ...CONTENT_PAGES.flatMap((slug) => pageFiles(slug)),
];

const markdownRoute = (dest, extra = {}) => ({
  dest,
  has: [{ key: "accept", type: "header", value: MARKDOWN_ACCEPT }],
  headers: { vary: "Accept" },
  src: "^/.*$",
  ...extra,
});

const routingConfig = {
  routes: [
    markdownRoute("/index.md", { src: "^/$" }),
    markdownRoute("$1.md", { src: "^(/quickstart)/?$" }),
    markdownRoute("/404.md", { status: 404 }),
    {
      dest: "/404.json",
      has: [{ key: "accept", type: "header", value: JSON_ACCEPT }],
      headers: { vary: "Accept" },
      src: "^/.*$",
      status: 404,
    },
  ],
  version: 3,
};

const markdown404 = [
  "# Page not found",
  "",
  "We couldn't find the page you're looking for.",
  "",
  "- [Sitemap](https://example.com/sitemap.xml)",
  "- [Docs index for AI agents (llms.txt)](https://example.com/llms.txt)",
].join("\n");

const problem404 = {
  code: "PAGE_NOT_FOUND",
  detail: "We couldn't find the page you're looking for.",
  resolution: "Where to look next: https://example.com/",
  status: 404,
  title: "Page not found",
  type: "about:blank",
};

const routesWithout = (predicate) => ({
  routes: routingConfig.routes.filter((route) => !predicate(route)),
  version: 3,
});

describe("pageFiles", () => {
  it("maps the home page to its two root files", () => {
    expect(pageFiles("index")).toEqual(["index.html", "index.md"]);
  });

  it("maps a content page to its directory and its Markdown mirror", () => {
    expect(pageFiles("quickstart")).toEqual([
      "quickstart/index.html",
      "quickstart.md",
    ]);
  });
});

describe("missingFiles", () => {
  it("accepts a build that carries every promised artifact", () => {
    expect(missingFiles(completeBuild)).toEqual([]);
  });

  it("names an artifact the build dropped", () => {
    const present = completeBuild.filter((path) => path !== "llms.txt");
    expect(missingFiles(present)).toEqual(["llms.txt"]);
  });

  it("requires the Markdown mirror of every page, developer portal included", () => {
    expect(completeBuild).toContain("developers.md");
    const present = completeBuild.filter((path) => path !== "developers.md");
    expect(missingFiles(present)).toEqual(["developers.md"]);
  });
});

describe("routingProblems", () => {
  it("accepts the negotiation rules a Vercel server build writes", () => {
    expect(routingProblems(routingConfig)).toEqual([]);
  });

  it("rejects a static build's absent or older config", () => {
    expect(routingProblems(null)).toHaveLength(1);
    expect(routingProblems({ routes: [], version: 2 })).toHaveLength(1);
  });

  it("reports a config with no homepage negotiation", () => {
    const config = routesWithout((route) => route.dest === "/index.md");
    expect(routingProblems(config)).toContain(
      "No rule serves the homepage as Markdown for Accept: text/markdown."
    );
  });

  it("reports a config with no per-page Markdown mirror", () => {
    const config = routesWithout((route) => route.dest === "$1.md");
    expect(routingProblems(config)).toContain(
      "No rule serves a content page's .md mirror for Accept: text/markdown."
    );
  });

  it("reports a config that never varies on Accept", () => {
    const config = {
      routes: routingConfig.routes.map(({ headers, ...route }) => route),
      version: 3,
    };
    expect(routingProblems(config)).toContain(
      "No rule sets Vary: Accept, so a cache cannot keep the two representations apart."
    );
  });

  it("reports a Markdown 404 that loses its status", () => {
    const config = {
      routes: routingConfig.routes.map((route) =>
        route.dest === "/404.md" ? { ...route, status: undefined } : route
      ),
      version: 3,
    };
    expect(routingProblems(config)).toContain(
      "No rule answers a missing page with the Markdown body and a 404 status."
    );
  });

  it("reports a JSON 404 that only answers Markdown clients", () => {
    const config = {
      routes: routingConfig.routes.map((route) =>
        route.dest === "/404.json"
          ? {
              ...route,
              has: [{ key: "accept", type: "header", value: MARKDOWN_ACCEPT }],
            }
          : route
      ),
      version: 3,
    };
    expect(routingProblems(config)).toContain(
      "No rule answers a missing page with the JSON problem document and a 404 status."
    );
  });
});

describe("markdownErrorProblems", () => {
  it("accepts a body that explains the error and links out", () => {
    expect(markdownErrorProblems(markdown404)).toEqual([]);
  });

  it("rejects an empty body", () => {
    expect(markdownErrorProblems("")).toHaveLength(2);
    expect(markdownErrorProblems(null)).toHaveLength(2);
  });

  it("rejects a body that explains nothing", () => {
    expect(
      markdownErrorProblems("# Not found\n\nNothing to see on this server.")
    ).toEqual([
      "The Markdown 404 body names no recovery link — a docs, sitemap, or llms.txt URL.",
    ]);
  });

  it("rejects a body too short to act on, even with a link", () => {
    expect(markdownErrorProblems("See /sitemap.xml")).toEqual([
      "The Markdown 404 body is 16 characters; an agent needs at least 20 to act on it.",
    ]);
  });
});

describe("problemDocumentProblems", () => {
  it("accepts an RFC 9457 problem document", () => {
    expect(problemDocumentProblems(problem404)).toEqual([]);
  });

  it("rejects a body that is not a problem document", () => {
    expect(problemDocumentProblems(null)).toEqual([
      "The JSON 404 body is not a problem document.",
    ]);
  });

  it("reports each field an agent would branch on", () => {
    expect(problemDocumentProblems({})).toEqual([
      "The JSON problem document does not carry status 404.",
      "The JSON problem document carries no machine-readable code for an agent to branch on.",
      "The JSON problem document needs a detail an agent can act on.",
      "The JSON problem document needs a resolution hint.",
    ]);
    expect(problemDocumentProblems({ ...problem404, status: 200 })).toEqual([
      "The JSON problem document does not carry status 404.",
    ]);
  });
});

describe("audit", () => {
  it("passes a build that carries every surface", () => {
    expect(
      audit({
        config: routingConfig,
        markdown404,
        present: completeBuild,
        problem404,
      })
    ).toEqual([]);
  });

  it("collects a dropped file alongside a broken routing config", () => {
    const problems = audit({
      config: null,
      markdown404: "",
      present: completeBuild.filter((path) => path !== "404.md"),
      problem404: null,
    });
    expect(problems).toContain("The build is missing 404.md.");
    expect(problems).toContain(
      "No Version 3 Build Output config, so Accept: text/markdown negotiation is not wired."
    );
    expect(problems).toContain("The JSON 404 body is not a problem document.");
  });
});
