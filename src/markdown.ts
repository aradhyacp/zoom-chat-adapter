/**
 * Zoom-specific format conversion using AST-based parsing.
 *
 * Zoom Team Chat has two ways to render a message body:
 *
 * 1. Structured segments (`is_markdown_support` off). Each body item is plain
 *    text plus an optional `style: { bold, italic }`. This cannot express
 *    links, strikethrough, block quotes or images, so those were previously
 *    flattened away — the text inside them simply disappeared.
 *
 * 2. Markdown (`is_markdown_support: true`). Zoom parses the body text and
 *    supports *bold*, _italic_, ~strikethrough~, `monospace`,
 *    "> block quote", <https://links>, <img:url|alt> images and mentions.
 *    When this is on, Zoom ignores `style`, so all formatting must live in
 *    the text itself.
 *
 * This converter defaults to Markdown mode because it is the only mode that
 * can render more than bold/italic. Set `markdownSupport: false` to fall back
 * to structured segments.
 *
 * Zoom platform limits (not fixable in this adapter):
 * - There is no underline token. `__text__` is therefore emitted as plain
 *   text; the words are kept, the underline styling is not.
 * - There are no table tokens. Tables are rendered as pipe-separated text so
 *   the data is preserved instead of dropped.
 */

import type { AdapterPostableMessage } from "chat";
import {
  BaseFormatConverter,
  type Content,
  convertEmojiPlaceholders,
  parseMarkdown,
  type Root,
  walkAst,
} from "chat";
import type {
  Blockquote,
  Code,
  Heading,
  Image,
  Link,
  List,
  Paragraph,
  PhrasingContent,
  Table,
  Text,
} from "mdast";
import type { UnderlineNode } from "./types.js";

export interface ZoomContentBodyItem {
  style?: { bold?: boolean; italic?: boolean };
  text: string;
  type: "message";
}

/** Options for converting an AST into a Zoom message body. */
export interface ZoomContentBodyOptions {
  /**
   * Emit Markdown and let Zoom parse it. Required for links, strikethrough,
   * block quotes and images — the structured `style` API cannot express them.
   */
  markdown?: boolean;
}

/** Standard phrasing content plus the adapter's private underline node. */
type ZoomPhrasingContent = PhrasingContent | UnderlineNode;

/** Placeholders used to hide code spans from the Zoom token regexes. */
const PROTECT_START = "\uE000";
const PROTECT_END = "\uE001";
const PROTECT_PATTERN = /\uE000(\d+)\uE001/g;

const resolveText = (text: string): string =>
  convertEmojiPlaceholders(text, "whatsapp");

/** Characters that would otherwise be read as Zoom Markdown syntax. */
const ZOOM_MARKDOWN_SPECIAL = /[\\*_~`<>]/g;

const escapeText = (value: string): string =>
  value.replace(ZOOM_MARKDOWN_SPECIAL, "\\$&");

const codeSpan = (value: string): string => {
  const fence = value.includes("`") ? "``" : "`";
  return `${fence}${value}${fence}`;
};

const childrenOf = (node: unknown): PhrasingContent[] =>
  (node as { children: PhrasingContent[] }).children;

const blockChildrenOf = (node: unknown): Content[] =>
  (node as { children: Content[] }).children;

// ---------------------------------------------------------------------------
// Markdown mode: AST -> Zoom Markdown
// ---------------------------------------------------------------------------

function inlineNodes(nodes: readonly ZoomPhrasingContent[]): string {
  return nodes.map((node) => inlineNode(node)).join("");
}

function inlineNode(node: ZoomPhrasingContent): string {
  const { type } = node as { type: string };
  switch (type) {
    case "text":
      return escapeText(resolveText((node as Text).value));
    case "strong":
      // Zoom's chatbot Markdown parser uses the LEGACY single-asterisk bold.
      // Its docs table says `**text**`, but that renders as plain text — the
      // request example in the same page uses `*text*`.
      // Verified against the live client: `*x*` and `***x***` render bold;
      // `**x**` and `__x__` render plain. `_x_` is italic, `~x~` strike.
      return `*${inlineNodes(childrenOf(node))}*`;
    case "emphasis":
      return `_${inlineNodes(childrenOf(node))}_`;
    case "delete":
      return `~${inlineNodes(childrenOf(node))}~`;
    case "inlineCode":
      return codeSpan((node as { value: string }).value);
    case "link":
      return linkToZoom(node as Link);
    case "image":
      return imageToZoom(node as Image);
    case "break":
      return "\n";
    case "html":
      return resolveText((node as { value: string }).value);
    case "underline":
      // Zoom has no underline token. Keep the words, drop the styling rather
      // than leaking literal __underscores__ into the message.
      return inlineNodes(childrenOf(node));
    default:
      return "";
  }
}

function linkToZoom(node: Link): string {
  const label = inlineNodes(node.children).trim();
  if (!label || label === node.url) {
    return `<${node.url}>`;
  }
  // Zoom documents only the bare <url> form. Keeping the label as text means
  // the words the author wrote survive, and the URL stays clickable.
  return `${label} <${node.url}>`;
}

function imageToZoom(node: Image): string {
  const alt = node.alt?.trim();
  return alt ? `<img:${node.url}|${alt}>` : `<img:${node.url}>`;
}

function blockNodes(blocks: readonly Content[]): string {
  return blocks
    .map((block) => blockNode(block))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function blockNode(block: Content): string {
  const { type } = block as { type: string };
  switch (type) {
    case "paragraph":
      return inlineNodes(childrenOf(block));
    case "heading":
      // Zoom has no heading token, so a heading becomes a bold line.
      return `*${inlineNodes(childrenOf(block))}*`;
    case "blockquote":
      return quoteBlock(block as Blockquote);
    case "list":
      return listBlock(block as List);
    case "code":
      return codeBlock(block as Code);
    case "table":
      return tableBlock(block as Table);
    case "thematicBreak":
      return "──────────";
    case "html":
      return (block as { value: string }).value;
    default:
      return "";
  }
}

function quoteBlock(block: Blockquote): string {
  return blockNodes(blockChildrenOf(block))
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function listItemChild(child: Content): string {
  const { type } = child as { type: string };
  if (type === "paragraph") {
    return inlineNodes(childrenOf(child));
  }
  if (type === "list") {
    return listBlock(child as List);
  }
  return "";
}

function listBlock(list: List): string {
  return list.children
    .map((item, index) => {
      // Zoom does not document list tokens, but a real bullet always renders.
      const marker = list.ordered ? `${(list.start ?? 1) + index}. ` : "• ";
      const body = blockChildrenOf(item)
        .map((child) => listItemChild(child))
        .filter((text) => text.length > 0)
        .join("\n");
      return `${marker}${body}`;
    })
    .join("\n");
}

function codeBlock(block: Code): string {
  return `\`\`\`${block.lang ?? ""}\n${block.value}\n\`\`\``;
}

function tableBlock(table: Table): string {
  return table.children
    .map((row, rowIndex) =>
      row.children
        .map((cell) => {
          const value = inlineNodes(cell.children);
          return rowIndex === 0 ? `*${value}*` : value;
        })
        .join(" | ")
    )
    .join("\n");
}

function astToZoomMarkdown(ast: Root): string {
  return blockNodes(ast.children).trim();
}

// ---------------------------------------------------------------------------
// Structured mode: AST -> text segments with per-segment style
// ---------------------------------------------------------------------------

function extractText(nodes: readonly ZoomPhrasingContent[]): string {
  return nodes.map((node) => extractNodeText(node)).join("");
}

/**
 * Extract the readable text of one phrasing node. Every branch must keep the
 * words: a node type that returns "" silently deletes what the user wrote.
 */
function extractNodeText(node: ZoomPhrasingContent): string {
  const { type } = node as { type: string };
  switch (type) {
    case "text":
      return resolveText((node as Text).value);
    case "strong":
    case "emphasis":
    case "delete":
    case "underline":
      return extractText(childrenOf(node));
    case "inlineCode":
      return codeSpan((node as { value: string }).value);
    case "html":
      return resolveText((node as { value: string }).value);
    case "link": {
      const link = node as Link;
      const label = extractText(link.children);
      return label && label !== link.url ? `${label} (${link.url})` : link.url;
    }
    case "image":
      return (node as Image).alt ?? "";
    case "break":
      return "\n";
    default:
      return "";
  }
}

const isAllBold = (nodes: PhrasingContent[]): boolean =>
  nodes.length > 0 &&
  nodes.every(
    (node) =>
      node.type === "strong" ||
      (node.type === "text" && (node as Text).value.trim() === "")
  );

const paragraphSegment = (
  children: PhrasingContent[]
): ZoomContentBodyItem | null => {
  const text = extractText(children).trim();
  if (!text) {
    return null;
  }
  const style = isAllBold(children) ? { bold: true } : undefined;
  return { text, type: "message", ...(style ? { style } : {}) };
};

const headingSegment = (block: Heading): ZoomContentBodyItem | null => {
  const text = extractText(block.children).trim();
  if (!text) {
    return null;
  }
  return { style: { bold: true }, text, type: "message" };
};

const listSegments = (block: List): ZoomContentBodyItem[] => {
  const segments: ZoomContentBodyItem[] = [];
  block.children.forEach((item, index) => {
    const marker = block.ordered ? `${(block.start ?? 1) + index}.` : "\u2022";
    for (const child of item.children) {
      if (child.type === "paragraph") {
        const text = extractText(child.children).trim();
        if (text) {
          segments.push({ text: `${marker} ${text}`, type: "message" });
        }
      }
    }
  });
  return segments;
};

const quoteSegments = (block: Blockquote): ZoomContentBodyItem[] => {
  const text = blockChildrenOf(block)
    .filter((child): child is Paragraph => child.type === "paragraph")
    .map((child) => extractText(child.children).trim())
    .filter((line) => line.length > 0)
    .map((line) => `> ${line}`)
    .join("\n");
  return text ? [{ text, type: "message" }] : [];
};

const tableSegments = (table: Table): ZoomContentBodyItem[] =>
  table.children.map((row) => ({
    text: row.children
      .map((cell) => extractText(cell.children).trim())
      .join(" | "),
    type: "message",
  }));

/** Structured-mode body items for a single block. */
function structuredBlockSegments(block: Content): ZoomContentBodyItem[] {
  const { type } = block as { type: string };
  if (type === "paragraph") {
    const segment = paragraphSegment(childrenOf(block));
    return segment ? [segment] : [];
  }
  if (type === "heading") {
    const segment = headingSegment(block as Heading);
    return segment ? [segment] : [];
  }
  if (type === "list") {
    return listSegments(block as List);
  }
  if (type === "code") {
    return [
      {
        text: `\`\`\`\n${(block as Code).value}\n\`\`\``,
        type: "message",
      },
    ];
  }
  if (type === "blockquote") {
    return quoteSegments(block as Blockquote);
  }
  if (type === "table") {
    return tableSegments(block as Table);
  }
  return [];
}

export class ZoomFormatConverter extends BaseFormatConverter {
  /**
   * Pass strings, `raw` and `markdown` through untouched.
   *
   * The base implementation re-parses them as STANDARD Markdown first, where
   * `__text__` means bold. That silently destroyed Zoom's `__underline__`
   * token (and rewrote single-tilde strikethrough) before `toAst()` saw it.
   */
  override renderPostable(message: AdapterPostableMessage): string {
    if (typeof message === "string") {
      return resolveText(message);
    }
    if ("markdown" in message) {
      return resolveText(message.markdown);
    }
    if ("raw" in message) {
      return resolveText(message.raw);
    }
    return resolveText(super.renderPostable(message));
  }

  /**
   * Convert mdast to a Zoom content body array.
   *
   * With `markdown: true` this is a single Markdown segment that Zoom parses.
   * Otherwise it is a list of plain-text segments with per-segment style.
   */
  toZoomContentBody(
    ast: Root,
    options: ZoomContentBodyOptions = {}
  ): ZoomContentBodyItem[] {
    if (options.markdown) {
      return [{ text: astToZoomMarkdown(ast), type: "message" }];
    }

    const segments = ast.children.flatMap((block) =>
      structuredBlockSegments(block)
    );
    return segments.length > 0 ? segments : [{ text: "", type: "message" }];
  }

  /**
   * Convert Zoom markdown to mdast.
   *
   * Zoom tokens vs standard markdown:
   * - __underline__ — custom "underline" node (via link-sentinel approach)
   * - ~strikethrough~ — "delete" node (single → double tilde before parse)
   * - **bold**, _italic_, `code`, # heading, * list — standard (no conversion)
   */
  toAst(markdown: string): Root {
    const standardMarkdown = this.toStandardMarkdown(markdown);
    const ast = parseMarkdown(standardMarkdown);
    // Post-process: convert sentinel link nodes to UnderlineNode
    return walkAst(ast, (node: Content) => {
      if (
        node.type === "link" &&
        (node as Content & { url?: string }).url === "zoom-ul:"
      ) {
        const linkNode = node as Content & {
          url: string;
          children: PhrasingContent[];
        };
        return {
          children: linkNode.children,
          type: "underline",
        } as unknown as Content;
      }
      return node;
    });
  }

  /** Convert mdast to the Zoom Markdown dialect used on the wire. */
  fromAst(ast: Root): string {
    return astToZoomMarkdown(ast);
  }

  /**
   * Convert a postable message to mdast.
   *
   * `{ ast }` messages are used as-is. Running them through `renderPostable`
   * would serialize them with the ZOOM dialect and then re-parse that text as
   * Zoom Markdown — a lossy round-trip that turns bold (`*x*`) into italic,
   * because single asterisks also mean emphasis in standard Markdown.
   */
  toAstFromPostable(message: AdapterPostableMessage): Root {
    if (typeof message !== "string" && "ast" in message) {
      return message.ast;
    }
    return this.toAst(this.renderPostable(message));
  }

  /**
   * Pre-process Zoom markdown to standard markdown for parseMarkdown().
   *
   * CRITICAL: handle __underline__ BEFORE standard markdown processing, since
   * double underscore is a superset of single underscore at regex level.
   *
   * Code spans and fences are swapped for placeholders first so the regexes
   * cannot rewrite user code that merely looks like Zoom syntax.
   */
  private toStandardMarkdown(text: string): string {
    const protectedRuns: string[] = [];
    const protect = (match: string): string => {
      protectedRuns.push(match);
      return `${PROTECT_START}${protectedRuns.length - 1}${PROTECT_END}`;
    };

    let result = text
      .replace(/```[\s\S]*?```/g, protect)
      .replace(/`[^`\n]*`/g, protect);

    // 1. __text__ -> link sentinel parsed back into an underline node.
    result = result.replace(/__([^\n_]+?)__/g, "[$1](zoom-ul:)");

    // 2. ~text~ -> ~~text~~ (single → double tilde).
    result = result.replace(/(?<!~)~(?!~)([^\n~]+?)(?<!~)~(?!~)/g, "~~$1~~");

    return result.replace(
      PROTECT_PATTERN,
      (_match, index: string) => protectedRuns[Number(index)] ?? ""
    );
  }
}
