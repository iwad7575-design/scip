import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Content processing ───────────────────────────────────────────────────────

const STD_DISCLAIMER =
  "⚠️ This information is intended to support clinical decision-making and should not replace the judgment of a qualified clinician.";

// Strip file extensions from reference names (e.g. "Guidelines (2021).pdf" → "Guidelines (2021)")
function cleanExtensions(text: string): string {
  return text.replace(/\.(pdf|docx|doc)\b/gi, "").replace(/ {2,}/g, " ");
}

// Matches the start of a disclaimer paragraph
const DISCLAIMER_START_RE =
  /^(?:⚠️\s*)?(?:disclaimer\b|this information is (?:general guidance|intended to support|for general guidance)|do not use without consulting|for clinical use\b)/i;

// Matches the start of a references section header line (multi-line context)
const REFS_HEADER_RE =
  /^(?:📚\s*)?(?:\*{0,2}\s*)?references?(?:\s*\*{0,2})?[:\s]/im;

// Matches a standalone refs header line (single-line test, no trailing char required)
const REFS_LINE_RE =
  /^(📚\s*)?(?:\*{0,2}\s*)?references?(?:\s*\*{0,2})?(?:[:\s].*)?$/i;

// Matches the follow-up prompt the agent appends at the end, e.g.:
// "🔍 For background, ask: approach to TB"
// "💊 For management, ask: treatment of malaria"
const FOLLOWUP_RE =
  /^[🔍💊🧪🏥🚨📋]\s+(?:For\b|To\b|Ask\b)/i;

// ── ARV drug name expansion ───────────────────────────────────────────────────

const ARV_NAMES: Record<string, string> = {
  "TDF":   "Tenofovir (TDF)",
  "3TC":   "Lamivudine (3TC)",
  "DTG":   "Dolutegravir (DTG)",
  "EFV":   "Efavirenz (EFV)",
  "AZT":   "Zidovudine (AZT)",
  "ABC":   "Abacavir (ABC)",
  "NVP":   "Nevirapine (NVP)",
  "LPV/r": "Lopinavir/ritonavir (LPV/r)",
  "ATV/r": "Atazanavir/ritonavir (ATV/r)",
  "FTC":   "Emtricitabine (FTC)",
  "TAF":   "Tenofovir alafenamide (TAF)",
  "RAL":   "Raltegravir (RAL)",
  "DRV/r": "Darunavir/ritonavir (DRV/r)",
  "RPV":   "Rilpivirine (RPV)",
  "CAB":   "Cabotegravir (CAB)",
};

// Expand the FIRST occurrence of each ARV abbreviation to its full name.
// Subsequent occurrences keep the short form.
//
// Safe to run on raw markdown — e.g. **TDF** → **Tenofovir (TDF)**
// because the asterisks sit outside the replaced token.
function expandArvNames(text: string): string {
  let result = text;
  for (const [abbr, full] of Object.entries(ARV_NAMES)) {
    // If the full expanded form is already present, skip entirely
    if (result.includes(full)) continue;
    // Escape regex-special chars in the abbreviation (handles / in LPV/r etc.)
    const esc = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Negative lookbehind/lookahead: must not be preceded or followed by
    // word chars or ( ) so we don't match inside "13TC" or "(TDF)"
    const re = new RegExp(`(?<![A-Za-z0-9(])${esc}(?![A-Za-z0-9)])`, "");
    result = result.replace(re, full);
  }
  return result;
}

// Normalize inline refs "📚 References: A; B" → proper markdown bullet list
function normalizeRefs(refs: string): string {
  const lines = refs.split("\n");
  const out: string[] = [];
  let inRefs = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty lines pass through
    if (!trimmed) { out.push(line); continue; }

    // Detect and normalize the refs header line
    if (!inRefs && REFS_LINE_RE.test(trimmed)) {
      inRefs = true;
      const colonPos = trimmed.indexOf(":");
      const afterColon = colonPos !== -1 ? trimmed.slice(colonPos + 1).trim() : "";
      out.push("📚 **References**");
      // If inline refs follow the colon ("📚 References: A; B; C"), emit bullets now
      if (afterColon) {
        afterColon.split(";").map(s => s.trim()).filter(Boolean)
          .forEach(item => out.push(`- ${item}`));
      }
      continue;
    }

    // Inside refs: lines not already in list format → convert to bullet items
    if (
      inRefs &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("*") &&
      !/^\d+\./.test(trimmed)
    ) {
      out.push(`- ${trimmed}`);
    } else {
      out.push(line);
    }
  }

  return out.join("\n");
}

// Remove duplicate list items from the references section
function deduplicateRefs(text: string): string {
  const seen = new Set<string>();
  return text.split("\n").filter(line => {
    const isList = /^[\s]*[-*•]|\d+\./.test(line);
    if (!isList) return true;
    const key = line.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join("\n");
}

function splitResponse(text: string): {
  body: string;
  refs: string | null;
  disclaimer: string | null;
  followup: string | null;
} {
  if (!text.trim()) return { body: text, refs: null, disclaimer: null, followup: null };

  const parts = text.trim().split(/\n\n+/);
  let disclaimer: string | null = null;
  let refs: string | null = null;
  let followup: string | null = null;

  // Extract disclaimer — check last 2 paragraphs
  for (let i = parts.length - 1; i >= Math.max(0, parts.length - 2); i--) {
    if (DISCLAIMER_START_RE.test(parts[i].trim())) {
      disclaimer = STD_DISCLAIMER;
      parts.splice(i, 1);
      break;
    }
  }

  // Extract follow-up prompt — check last 2 paragraphs
  for (let i = parts.length - 1; i >= Math.max(0, parts.length - 2); i--) {
    if (FOLLOWUP_RE.test(parts[i].trim())) {
      followup = parts[i].trim();
      parts.splice(i, 1);
      break;
    }
  }

  // Extract references — everything from the first refs-header paragraph onward
  const refIdx = parts.findIndex(p => REFS_HEADER_RE.test(p.trim()));
  if (refIdx !== -1) {
    const rawRefs = parts.slice(refIdx).join("\n\n").trim();
    refs = deduplicateRefs(normalizeRefs(rawRefs));
    parts.splice(refIdx);
  }

  return { body: parts.join("\n\n").trim(), refs, disclaimer, followup };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (React.isValidElement(node))
    return getNodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}

// ── Styles ───────────────────────────────────────────────────────────────────

const LIST_CSS = `
.md-body { font-size: 15px; line-height: 1.7; }
.md-body p { margin: 0 0 8px; }
.md-body p:last-child { margin-bottom: 0; }
.md-body ul,
.md-body ol { padding-left: 20px; margin: 0 0 8px; }
.md-body ul:last-child,
.md-body ol:last-child { margin-bottom: 0; }

/* Level 1 */
.md-body ul > li            { list-style-type: disc;   font-size: 15px; font-weight: 500; margin-bottom: 4px; line-height: 1.6; }
.md-body ol > li            { list-style-type: decimal; font-size: 15px; font-weight: 500; margin-bottom: 4px; line-height: 1.6; }

/* Level 2 */
.md-body ul ul > li         { list-style-type: circle;  font-size: 14px; font-weight: 400; color: #444; margin-bottom: 3px; }
.md-body ol ol > li,
.md-body ul ol > li,
.md-body ol ul > li         { list-style-type: lower-alpha; font-size: 14px; font-weight: 400; color: #444; margin-bottom: 3px; }

/* Level 3 */
.md-body ul ul ul > li      { list-style-type: square;  font-size: 14px; font-weight: 400; color: #666; margin-bottom: 2px; }
.md-body ol ol ol > li      { list-style-type: lower-roman; font-size: 14px; font-weight: 400; color: #666; margin-bottom: 2px; }

/* Nested indentation */
.md-body ul ul,
.md-body ol ol,
.md-body ul ol,
.md-body ol ul { padding-left: 20px; margin-top: 4px; margin-bottom: 0; }

.md-body h1 { font-size: 17px; font-weight: 700; color: var(--brand-navy); margin: 12px 0 6px; line-height: 1.3; }
.md-body h2 { font-size: 15px; font-weight: 700; color: var(--brand-navy); margin: 10px 0 5px; line-height: 1.3; }
.md-body h3 { font-size: 14px; font-weight: 600; color: var(--brand-navy); margin: 8px 0 4px;  line-height: 1.3; }
.md-body h1:first-child,
.md-body h2:first-child,
.md-body h3:first-child { margin-top: 0; }

.md-body strong { font-weight: 700; color: var(--brand-navy); }
.md-body em { font-style: italic; }
.md-body code { font-family: monospace; font-size: 13px; background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; }
.md-body pre  { background: rgba(0,0,0,0.06); border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 0 0 8px; }
.md-body pre code { background: none; padding: 0; font-size: 13px; }
.md-body hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
.md-body blockquote { border-left: 3px solid var(--brand-green); padding: 4px 12px; margin: 0 0 8px; color: #555; }
.md-body a { color: var(--brand-green); text-decoration: underline; }

/* → drug choice labels */
.md-choice-label {
  font-weight: 700;
  color: var(--brand-navy);
  font-size: 14px;
  margin: 10px 0 2px;
}

/* References section */
.md-refs {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
  font-size: 13px;
  color: #444;
  line-height: 1.6;
}
.md-refs strong { color: var(--brand-navy) !important; font-size: 14px; }
.md-refs ul, .md-refs ol { padding-left: 16px; margin: 4px 0 0; }
.md-refs ul > li, .md-refs ol > li { font-size: 13px; font-weight: 400; margin-bottom: 2px; color: #444; list-style-type: disc; }

/* Follow-up prompt */
.md-followup {
  margin-top: 14px;
  padding: 7px 12px 7px 14px;
  border-left: 3px solid var(--brand-green);
  font-size: 13px;
  color: var(--brand-navy);
  font-style: italic;
  line-height: 1.55;
}
.md-followup p { margin: 0; }

/* Disclaimer section */
.md-disclaimer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #eee;
  font-size: 12px;
  color: #888;
  font-style: italic;
  line-height: 1.55;
  white-space: pre-line;
}
`;

let styleInjected = false;
function injectStyles() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = LIST_CSS;
  document.head.appendChild(el);
}

// ── Section emoji injection ───────────────────────────────────────────────────

const SECTION_EMOJIS: Array<[RegExp, string]> = [
  [/\bdiagnosis\b|\bclassification\b/i, "🔍"],
  [/\btreatment\b|\bmanagement\b/i, "💊"],
  [/\bmedications\b|\bdosing\b/i, "💉"],
  [/red flags|danger signs/i, "⚠️"],
  [/\binvestigations\b/i, "🧪"],
  [/\breferral\b|\bescalation\b/i, "🏥"],
  [/follow[\s-]?up|\bmonitoring\b/i, "📋"],
  [/\bemergency\b/i, "🚨"],
  [/\breferences?\b/i, "📚"],
  [/\bpediatric\b/i, "👶"],
  [/\bmaternal\b/i, "🤰"],
  [/special populations/i, "🌡️"],
];

const KNOWN_EMOJIS = ["🔍","💊","💉","⚠️","🧪","🏥","📋","🚨","📚","👶","🤰","🌡️"];

function withSectionEmoji(children: React.ReactNode): React.ReactNode {
  const text = getNodeText(children).trim();
  if (KNOWN_EMOJIS.some(e => text.startsWith(e))) return children;
  for (const [re, emoji] of SECTION_EMOJIS) {
    if (re.test(text)) return <>{emoji} {children}</>;
  }
  return children;
}

// ── Shared component map ─────────────────────────────────────────────────────

type NodeProps = { children?: React.ReactNode };
type AnchorProps = { href?: string; children?: React.ReactNode };

const mdComponents = {
  p: ({ children }: NodeProps) => {
    // Style "→ Choose ONE:" / "→ Give BOTH:" lines as bold choice labels
    const text = getNodeText(children).trim();
    if (text.startsWith("→")) {
      return <p className="md-choice-label">{children}</p>;
    }
    return <p>{children}</p>;
  },
  strong:     ({ children }: NodeProps) => <strong>{children}</strong>,
  em:         ({ children }: NodeProps) => <em>{children}</em>,
  ul:         ({ children }: NodeProps) => <ul>{children}</ul>,
  ol:         ({ children }: NodeProps) => <ol>{children}</ol>,
  li: ({ children }: NodeProps) => {
    // Detect ALL-CAPS sub-header list items (e.g. "**ADULTS:**", "**FIRST LINE:**")
    const text = getNodeText(children).trim();
    const isSubHeader =
      text.length >= 5 &&
      /^[A-Z][A-Z\d\s\/\-()&.,]+:\s*$/.test(text);
    return isSubHeader ? (
      <li style={{
        fontWeight: 600, color: "var(--brand-navy)", marginTop: 8,
        listStyleType: "none", marginLeft: -4,
      }}>
        {children}
      </li>
    ) : (
      <li>{children}</li>
    );
  },
  h1: ({ children }: NodeProps) => <h1>{withSectionEmoji(children)}</h1>,
  h2: ({ children }: NodeProps) => <h2>{withSectionEmoji(children)}</h2>,
  h3: ({ children }: NodeProps) => <h3>{withSectionEmoji(children)}</h3>,
  code:       ({ children }: NodeProps) => <code>{children}</code>,
  pre:        ({ children }: NodeProps) => <pre>{children}</pre>,
  blockquote: ({ children }: NodeProps) => <blockquote>{children}</blockquote>,
  hr:         () => <hr />,
  a: ({ href, children }: AnchorProps) => (
    <a href={href} target="_blank" rel="noreferrer">{children}</a>
  ),
};

// ── Component ────────────────────────────────────────────────────────────────

export function MarkdownMessage({ content }: { content: string }) {
  injectStyles();
  const { body, refs, disclaimer, followup } = useMemo(
    () => splitResponse(expandArvNames(cleanExtensions(content))),
    [content]
  );

  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {body}
      </ReactMarkdown>

      {refs && (
        <div className="md-refs">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {refs}
          </ReactMarkdown>
        </div>
      )}

      {followup && (
        <div className="md-followup">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {followup}
          </ReactMarkdown>
        </div>
      )}

      {disclaimer && (
        <div className="md-disclaimer">{disclaimer}</div>
      )}
    </div>
  );
}
