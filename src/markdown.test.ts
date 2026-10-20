import { parseMarkdown } from "chat";
import type { Heading, Paragraph } from "mdast";
import { describe, expect, it } from "vitest";
import { ZoomFormatConverter } from "./markdown.js";

const converter = new ZoomFormatConverter();

/** Convert Zoom Markdown to the body Zoom would receive in Markdown mode. */
function markdownBody(text: string): string {
  return converter.toZoomContentBody(converter.toAst(text), {
    markdown: true,
  })[0].text;
}

describe("ZoomFormatConverter.toAst() — FMT-01", () => {
  it("converts **bold** to strong node", () => {
    const ast = converter.toAst("**bold**");
    const para = ast.children[0] as Paragraph;
    expect(para.children[0].type).toBe("strong");
  });

  it("converts _italic_ to emphasis node", () => {
    const ast = converter.toAst("_italic_");
    const para = ast.children[0] as Paragraph;
    expect(para.children[0].type).toBe("emphasis");
  });

  it("converts `code` to inlineCode node", () => {
    const ast = converter.toAst("`code`");
    const para = ast.children[0] as Paragraph;
    expect(para.children[0].type).toBe("inlineCode");
  });

  it("converts ~strikethrough~ (single tilde) to delete node", () => {
    const ast = converter.toAst("~strikethrough~");
    const para = ast.children[0] as Paragraph;
    expect(para.children[0].type).toBe("delete");
  });

  it("converts __underline__ to custom underline node", () => {
    const ast = converter.toAst("__underline__");
    const para = ast.children[0] as Paragraph;
    expect(para.children[0].type).toBe("underline");
  });

  it("converts # heading to heading depth-1 node", () => {
    const ast = converter.toAst("# heading");
    expect(ast.children[0].type).toBe("heading");
    expect((ast.children[0] as Heading).depth).toBe(1);
  });

  it("converts * list item to list + listItem nodes", () => {
    const ast = converter.toAst("* list item");
    expect(ast.children[0].type).toBe("list");
  });

  it("does not rewrite Zoom syntax inside inline code", () => {
    const ast = converter.toAst("`~not strike~ and __not underline__`");
    const para = ast.children[0] as Paragraph;
    expect(para.children[0].type).toBe("inlineCode");
    expect((para.children[0] as { value: string }).value).toBe(
      "~not strike~ and __not underline__"
    );
  });

  it("does not rewrite Zoom syntax inside fenced code blocks", () => {
    const ast = converter.toAst("```\n~not strike~ and __not underline__\n```");
    expect(ast.children[0].type).toBe("code");
    expect((ast.children[0] as { value: string }).value).toBe(
      "~not strike~ and __not underline__"
    );
  });
});

describe("ZoomFormatConverter.fromAst() — FMT-02", () => {
  it("converts strong node to *bold* (Zoom's single-asterisk form)", () => {
    const ast = parseMarkdown("**bold**");
    expect(converter.fromAst(ast)).toBe("*bold*");
  });

  it("converts emphasis node to _italic_", () => {
    const ast = parseMarkdown("_italic_");
    expect(converter.fromAst(ast)).toContain("_italic_");
  });

  it("converts inlineCode node to `code`", () => {
    const ast = parseMarkdown("`code`");
    expect(converter.fromAst(ast)).toContain("`code`");
  });

  it("converts delete node to ~strikethrough~ (single tilde)", () => {
    const ast = parseMarkdown("~~strikethrough~~");
    const output = converter.fromAst(ast);
    expect(output).toContain("~strikethrough~");
    expect(output).not.toContain("~~strikethrough~~");
  });

  it("renders underline as plain text (Zoom has no underline token)", () => {
    const ast = converter.toAst("__underline__");
    const output = converter.fromAst(ast);
    expect(output).toBe("underline");
    expect(output).not.toContain("__");
  });

  it("renders headings as a bold line (Zoom has no heading token)", () => {
    const ast = parseMarkdown("# heading");
    expect(converter.fromAst(ast)).toBe("*heading*");
  });

  it("renders list items with a real bullet (Zoom has no list token)", () => {
    const ast = parseMarkdown("* list item");
    expect(converter.fromAst(ast)).toContain("• list item");
  });
});

describe("ZoomFormatConverter.toZoomContentBody() — markdown mode", () => {
  it("keeps the label and makes the URL clickable", () => {
    expect(markdownBody("See [the docs](https://example.com) for more")).toBe(
      "See the docs <https://example.com> for more"
    );
  });

  it("keeps the text of a strikethrough run", () => {
    expect(markdownBody("This is ~struck~ text")).toBe("This is ~struck~ text");
  });

  it("keeps the words of an underline run", () => {
    expect(markdownBody("This is __underlined__ text")).toBe(
      "This is underlined text"
    );
  });

  it("converts images to Zoom's image token", () => {
    expect(markdownBody("Logo: ![alt text](https://x.test/a.png)")).toBe(
      "Logo: <img:https://x.test/a.png|alt text>"
    );
  });

  it("keeps block quotes", () => {
    expect(markdownBody("> quoted line")).toBe("> quoted line");
  });

  it("renders table cells as text instead of dropping them", () => {
    expect(markdownBody("| a | b |\n|---|---|\n| 1 | 2 |")).toBe(
      "*a* | *b*\n1 | 2"
    );
  });

  it("keeps inline bold and italic", () => {
    expect(markdownBody("mixed **bold** and _italic_ in one line")).toBe(
      "mixed *bold* and _italic_ in one line"
    );
  });

  it("keeps whole-line bold", () => {
    expect(markdownBody("**entire line bold**")).toBe("*entire line bold*");
  });

  it("keeps inline code intact", () => {
    expect(markdownBody("run `pnpm test` now")).toBe("run `pnpm test` now");
  });

  it("escapes Markdown characters that were literal text", () => {
    expect(markdownBody("5 * 3 ~ 2")).toBe("5 \\* 3 \\~ 2");
  });

  it("leaves ordinary brackets alone", () => {
    expect(markdownBody("[1] plain label")).toBe("[1] plain label");
  });
});

describe("ZoomFormatConverter.toZoomContentBody() — structured mode", () => {
  function bodyText(text: string): string {
    return converter
      .toZoomContentBody(converter.toAst(text))
      .map((item) => item.text)
      .join("\n");
  }

  it("keeps a link label and URL", () => {
    expect(bodyText("See [the docs](https://example.com) for more")).toBe(
      "See the docs (https://example.com) for more"
    );
  });

  it("keeps strikethrough text", () => {
    expect(bodyText("This is ~struck~ text")).toBe("This is struck text");
  });

  it("keeps image alt text", () => {
    expect(bodyText("Logo: ![alt text](https://x.test/a.png)")).toBe(
      "Logo: alt text"
    );
  });

  it("keeps block quote text", () => {
    expect(bodyText("> quoted line")).toBe("> quoted line");
  });

  it("keeps table text", () => {
    expect(bodyText("| a | b |\n|---|---|\n| 1 | 2 |")).toBe("a | b\n1 | 2");
  });
});
