// biome-ignore lint/style/useFilenamingConvention: Blume derives each island's MDX component name from its PascalCase filename, so this file must stay PascalCase.
import { useCallback, useMemo, useState } from "react";

/**
 * Shows the three states of a message: what you write, the Markdown that goes
 * over the wire, and how Zoom renders that Markdown.
 *
 * The wire strings mirror ZoomFormatConverter in src/markdown.ts. If the
 * converter changes, change these samples too — this is a demo of real
 * behaviour, not an idealised one.
 *
 * The key fact the demo exists to show: bold leaves as `*bold*`, because Zoom's
 * chatbot parser renders `**bold**` as plain text.
 */

interface Sample {
  input: string;
  wire: string;
}

const SAMPLES: Record<string, Sample> = {
  blocks: {
    input:
      "> Rolled back at 14:02\n\n- api-gateway\n- billing\n\n# Incident report",
    wire: "> Rolled back at 14:02\n\n• api-gateway\n• billing\n\n*Incident report*",
  },
  inline: {
    input:
      "A **bold** word, an _italic_ one, ~struck~ text, and a `code` span.",
    wire: "A *bold* word, an _italic_ one, ~struck~ text, and a `code` span.",
  },
  limits: {
    input: "This is __underlined__ text.\n\n| a | b |\n|---|---|\n| 1 | 2 |",
    wire: "This is underlined text.\n\n*a* | *b*\n1 | 2",
  },
  links: {
    input:
      "See [the docs](https://example.com).\n\n![logo](https://developers.zoom.us/img/1575498795338.png)",
    wire: "See the docs <https://example.com>.\n\n<img:https://developers.zoom.us/img/1575498795338.png|logo>",
  },
  message: {
    input:
      "**Deploy finished**\n\nShipped `api-gateway` to _production_ in 94s.",
    wire: "*Deploy finished*\n\nShipped `api-gateway` to _production_ in 94s.",
  },
};

const SAMPLE_KEYS = Object.keys(SAMPLES);

const INLINE =
  /(`[^`\n]+`)|(<img:([^|>\n]+)\|([^>\n]*)>)|(<https?:\/\/[^>\n]+>)|(\*[^*\n]+\*)|(~[^~\n]+~)|(_[^_\n]+_)/g;

const CODE = /^`/;
const IMAGE = /^<img:/;
const URL = /^<https?:\/\//;

/** Turn one line of Zoom Markdown into the nodes a Zoom client would render. */
function inlineNodes(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  INLINE.lastIndex = 0;
  for (let match = INLINE.exec(text); match; match = INLINE.exec(text)) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [token, , , , alt] = match;
    const key = `${match.index}:${token}`;

    if (CODE.test(token)) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (IMAGE.test(token)) {
      nodes.push(
        <span className="demo-chip" key={key}>
          image{alt ? `: ${alt}` : ""}
        </span>
      );
    } else if (URL.test(token)) {
      nodes.push(
        <span className="demo-link" key={key}>
          {token.slice(1, -1)}
        </span>
      );
    } else if (token.startsWith("*")) {
      nodes.push(<strong key={key}>{token.slice(1, -1)}</strong>);
    } else if (token.startsWith("~")) {
      nodes.push(<s key={key}>{token.slice(1, -1)}</s>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderWire(wire: string): React.ReactNode {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of wire.split("\n")) {
    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks.map((lines, blockIndex) => (
    <div className="demo-block" key={blockIndex}>
      {lines.map((line, lineIndex) => {
        if (line.startsWith("> ")) {
          return (
            <p className="demo-quote" key={lineIndex}>
              {inlineNodes(line.slice(2))}
            </p>
          );
        }
        if (line.startsWith("• ")) {
          return (
            <p className="demo-bullet" key={lineIndex}>
              • {inlineNodes(line.slice(2))}
            </p>
          );
        }
        return (
          <p className="demo-line" key={lineIndex}>
            {inlineNodes(line)}
          </p>
        );
      })}
    </div>
  ));
}

export default function FormatPreview() {
  const [sample, setSample] = useState<string>("message");
  const selected = SAMPLES[sample];
  const rendered = useMemo(() => renderWire(selected.wire), [selected.wire]);

  const pick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setSample(event.currentTarget.dataset.sample ?? "message");
  }, []);

  return (
    <div className="demo">
      <p className="demo-label">The same message, three ways</p>
      <div className="demo-choices">
        {SAMPLE_KEYS.map((key) => (
          <button
            aria-pressed={key === sample}
            className="demo-choice"
            data-sample={key}
            key={key}
            onClick={pick}
            type="button"
          >
            {key}
          </button>
        ))}
      </div>

      <div className="demo-out">
        <p className="demo-out-label">You write (Chat SDK markdown)</p>
        <pre className="demo-json">{selected.input}</pre>
      </div>

      <div className="demo-out">
        <p className="demo-out-label">Zoom receives</p>
        <pre className="demo-json">{selected.wire}</pre>
      </div>

      <div className="demo-out">
        <p className="demo-out-label">Zoom shows</p>
        <div className="demo-render">{rendered}</div>
      </div>

      {sample === "limits" && (
        <p className="demo-note">
          Underline and tables have no Zoom token. The words and cells survive
          as plain text; the styling does not. See the table below.
        </p>
      )}

      {sample === "links" && (
        <p className="demo-note">
          The label is kept and the URL is clickable. The image only appears if
          its host is on Zoom's trusted-domain list —{" "}
          <code>developers.zoom.us</code> is.
        </p>
      )}
    </div>
  );
}
