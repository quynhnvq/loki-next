import type { ReactNode } from "react";

const SYNTAX_COLORS = {
  keyword: "#2dacf9",
  string: "#7ce95a",
  number: "#ffdf5f",
  jsxTag: "#fa73da",
  type: "#ff3c32",
  default: "inherit",
} as const;

type SyntaxKind = keyof typeof SYNTAX_COLORS;

const SYNTAX_KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "default",
  "function",
  "return",
  "let",
  "const",
  "var",
  "type",
  "interface",
  "enum",
  "class",
  "extends",
  "implements",
  "if",
  "else",
  "switch",
  "case",
  "break",
  "continue",
  "for",
  "while",
  "do",
  "try",
  "catch",
  "finally",
  "throw",
  "new",
  "await",
  "async",
  "typeof",
  "instanceof",
  "in",
  "of",
  "this",
  "super",
  "as",
  "satisfies",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "number",
  "string",
  "boolean",
  "any",
  "never",
  "unknown",
  "public",
  "private",
  "protected",
  "readonly",
  "static",
  "abstract",
]);

type SyntaxToken = { text: string; kind: SyntaxKind };

function tokenizeCode(code: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const regex =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(<\/?[A-Za-z][\w-]*)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_$][\w$]*\b)/g;

  let cursor = 0;
  for (let match = regex.exec(code); match !== null; match = regex.exec(code)) {
    if (match.index > cursor) {
      tokens.push({ text: code.slice(cursor, match.index), kind: "default" });
    }
    const [full, comment, str, jsxOpen, num, ident] = match;
    if (comment !== undefined) {
      tokens.push({ text: full, kind: "default" });
    } else if (str !== undefined) {
      tokens.push({ text: str, kind: "string" });
    } else if (jsxOpen !== undefined) {
      tokens.push({ text: jsxOpen, kind: "jsxTag" });
    } else if (num !== undefined) {
      tokens.push({ text: num, kind: "number" });
    } else if (ident !== undefined) {
      if (SYNTAX_KEYWORDS.has(ident)) {
        tokens.push({ text: ident, kind: "keyword" });
      } else if (/^[A-Z]/.test(ident)) {
        tokens.push({ text: ident, kind: "type" });
      } else {
        tokens.push({ text: ident, kind: "default" });
      }
    }
    cursor = match.index + full.length;
  }

  if (cursor < code.length) {
    tokens.push({ text: code.slice(cursor), kind: "default" });
  }

  return tokens;
}

const highlightedSnippetCache = new Map<string, ReactNode[]>();

function buildHighlightedCode(code: string) {
  return tokenizeCode(code).map((token, i) =>
    token.kind === "default" ? (
      <span key={i}>{token.text}</span>
    ) : (
      <span key={i} style={{ color: SYNTAX_COLORS[token.kind] }}>
        {token.text}
      </span>
    ),
  );
}

function renderHighlightedCode(code: string) {
  const cached = highlightedSnippetCache.get(code);
  if (cached !== undefined) return cached;
  const rendered = buildHighlightedCode(code);
  highlightedSnippetCache.set(code, rendered);
  return rendered;
}

const PRIMARY_PANEL_CLASS_BY_ID: Record<string, string> = {
  "full-stack": "feature-section__panel--full-stack",
  contact: "feature-section__panel--contact",
  "ai-ready": "feature-section__panel--ai-ready",
  "powerful-components": "feature-section__panel--powerful-components",
  "use-cases": "feature-section__panel--use-cases",
};

export type FeatureSectionProps = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  align: "left" | "right";
  ctaLabel?: string;
  ctaHref?: string;
  ctaIcon?: "eye";
  codeSnippet?: string;
  contact?: {
    email: string;
    phone: string;
    whatsapp: string;
  };
};

export function FeatureSection({
  id,
  kicker,
  title,
  body,
  align,
  ctaLabel,
  ctaHref,
  ctaIcon,
  codeSnippet,
  contact,
}: FeatureSectionProps) {
  const primaryPanelClass =
    PRIMARY_PANEL_CLASS_BY_ID[id] ??
    (align === "right"
      ? "feature-section__panel--align-right"
      : "feature-section__panel--align-left");

  const rowClass =
    id === "powerful-components"
      ? "feature-section__row feature-section__row--powerful-components"
      : "feature-section__row";

  return (
    <section id={id} className="feature-section">
      <div className={rowClass}>
        <div className={`feature-section__panel ${primaryPanelClass}`}>
          <p className="feature-section__kicker">{kicker}</p>
          <h2 className="feature-section__title">{title}</h2>
          <p className="feature-section__body">{body}</p>
          {ctaLabel && ctaHref ? (
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="feature-section__cta"
            >
              {ctaIcon === "eye" ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="feature-section__cta-icon"
                >
                  <path
                    fill="currentColor"
                    d="M12 5C6.5 5 2.1 8.3.5 12c1.6 3.7 6 7 11.5 7s9.9-3.3 11.5-7c-1.6-3.7-6-7-11.5-7Zm0 11.2A4.2 4.2 0 1 1 12 7.8a4.2 4.2 0 0 1 0 8.4Zm0-2.1a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z"
                  />
                </svg>
              ) : null}
              {ctaLabel}
            </a>
          ) : null}
          {contact ? (
            <div className="feature-section__contact-list">
              <div className="feature-section__contact-item">
                <p className="feature-section__contact-label">Email</p>
                <a
                  href={`mailto:${contact.email}`}
                  className="feature-section__contact-link"
                >
                  {contact.email}
                </a>
              </div>
              <div className="feature-section__contact-item">
                <p className="feature-section__contact-label">Phone</p>
                <a
                  href={`tel:${contact.phone.replace(/\s/g, "")}`}
                  className="feature-section__contact-link"
                >
                  {contact.phone}
                </a>
              </div>
              <div className="feature-section__contact-item">
                <p className="feature-section__contact-label">WhatsApp</p>
                <a
                  href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feature-section__contact-link"
                >
                  {contact.whatsapp}
                </a>
              </div>
            </div>
          ) : null}
        </div>
        {codeSnippet ? (
          <div className="feature-section__code-container">
            <pre className="feature-section__code-pre">
              <code>{renderHighlightedCode(codeSnippet)}</code>
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}
