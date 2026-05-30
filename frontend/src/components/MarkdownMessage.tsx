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

// Strip any raw citation tokens that leak through from nano responses
function cleanCitationTokens(text: string): string {
  return text
    .replace(/filecite\w*/gi, "")
    .replace(/turn\d+file\d+/gi, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

// Ensure lines starting with ⚠️ or section-emoji that immediately follow a
// bullet item are separated by a blank line. Without this, the markdown parser
// absorbs them as list continuations rather than new paragraphs, causing the
// disclaimer and follow-up prompt to render as bullet points inside the refs list.
function fixListBreaks(text: string): string {
  return text.replace(
    /(\n[-*•] [^\n]+)\n(⚠️|🔍|💊|🧪|🏥|🚨|📋|📚)/g,
    "$1\n\n$2",
  );
}

// Remove placeholder text the agent emits when it has no real references.
// The system prompt says "Every response ends with 📚 References + ⚠️ Disclaimer"
// so the model sometimes outputs that phrase literally instead of actual titles.
function cleanPlaceholderRefs(text: string): string {
  return text
    .replace(/📚\s*References\s*\+\s*⚠️\s*Disclaimer/g, "")
    .replace(/📚\s*References\s*\+\s*Disclaimer/g, "")
    .trim();
}

// ── Abbreviation expansion ───────────────────────────────────────────────────
// ARV drug abbreviations are ONLY expanded when the response contains HIV/ART
// context. This prevents clinical confusion where the same letters mean
// something else — most critically ABC = Airway/Breathing/Circulation in
// resuscitation and DKA contexts, NOT Abacavir.
//
// Medical abbreviations (TB, clinical, Ethiopian health system) are always
// safe to expand and are not gated.
//
// Longer keys are processed first to prevent partial matches
// (e.g. mWRD before WRD, MDR-TB before DR-TB).
// Safe on raw markdown — **TDF** → **Tenofovir (TDF)** leaves ** intact.

// ARV drug names — gated behind isHIVResponse()
const ARV_ABBREVIATIONS: Record<string, string> = {
  "LPV/r":   "Lopinavir/ritonavir (LPV/r)",
  "ATV/r":   "Atazanavir/ritonavir (ATV/r)",
  "DRV/r":   "Darunavir/ritonavir (DRV/r)",
  "TDF":     "Tenofovir (TDF)",
  "3TC":     "Lamivudine (3TC)",
  "DTG":     "Dolutegravir (DTG)",
  "EFV":     "Efavirenz (EFV)",
  "AZT":     "Zidovudine (AZT)",
  "ABC":     "Abacavir (ABC)",
  "NVP":     "Nevirapine (NVP)",
  "FTC":     "Emtricitabine (FTC)",
  "TAF":     "Tenofovir alafenamide (TAF)",
  "RAL":     "Raltegravir (RAL)",
  "RPV":     "Rilpivirine (RPV)",
  "CAB":     "Cabotegravir (CAB)",
};

// Medical abbreviations — always expanded regardless of clinical context
const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  // TB
  "TB-LAMP": "TB loop-mediated isothermal amplification (TB-LAMP)",
  "MDR-TB":  "multidrug-resistant TB (MDR-TB)",
  "LF-LAM":  "lateral flow urine lipoarabinomannan (LF-LAM)",
  "RR-TB":   "rifampicin-resistant TB (RR-TB)",
  "DR-TB":   "drug-resistant TB (DR-TB)",
  "mWRD":    "molecular WHO-recommended rapid diagnostic (mWRD)",
  "EPTB":    "extrapulmonary tuberculosis (EPTB)",
  "MTB":     "Mycobacterium tuberculosis (MTB)",
  "WRD":     "WHO-recommended rapid diagnostic (WRD)",
  "PTB":     "pulmonary tuberculosis (PTB)",
  "AFB":     "acid-fast bacilli (AFB)",
  "DST":     "drug susceptibility testing (DST)",
  "DOT":     "directly observed therapy (DOT)",
  "FDC":     "fixed-dose combination (FDC)",
  // HIV context terms (inherently HIV-specific — safe to always expand)
  "PMTCT":   "prevention of mother-to-child transmission (PMTCT)",
  "PLHIV":   "people living with HIV (PLHIV)",
  "RVI":     "retroviral infection / HIV (RVI)",
  "ART":     "antiretroviral therapy (ART)",
  "OI":      "opportunistic infection (OI)",
  "VL":      "viral load (VL)",
  // General clinical
  "IMNCI":   "integrated management of neonatal and childhood illness (IMNCI)",
  "MUAC":    "mid-upper arm circumference (MUAC)",
  "SpO2":    "oxygen saturation (SpO2)",
  "FNAC":    "fine needle aspiration cytology (FNAC)",
  "SOFA":    "sequential organ failure assessment (SOFA)",
  "SAAG":    "serum-ascites albumin gradient (SAAG)",
  "SAM":     "severe acute malnutrition (SAM)",
  "MAM":     "moderate acute malnutrition (MAM)",
  "HEW":     "health extension worker (HEW)",
  "ANC":     "antenatal care (ANC)",
  "CBC":     "complete blood count (CBC)",
  "LFT":     "liver function test (LFT)",
  "CXR":     "chest X-ray (CXR)",
  "CSF":     "cerebrospinal fluid (CSF)",
  "ESR":     "erythrocyte sedimentation rate (ESR)",
  "INR":     "international normalized ratio (INR)",
  "ECG":     "electrocardiogram (ECG)",
  "USS":     "ultrasound scan (USS)",
  "GCS":     "Glasgow Coma Scale (GCS)",
  "MAP":     "mean arterial pressure (MAP)",
  "RLQ":     "right lower quadrant (RLQ)",
  "LLQ":     "left lower quadrant (LLQ)",
  "JVP":     "jugular venous pressure (JVP)",
  "CT":      "computed tomography (CT)",
  "MRI":     "magnetic resonance imaging (MRI)",
};

// Returns true when the response text is about HIV/ART treatment,
// meaning ARV drug abbreviations are unambiguous in context.
function isHIVResponse(text: string): boolean {
  const hivTerms = [
    "antiretroviral", "ART", "RVI", "HIV", "PLHIV",
    "first-line regimen", "ARV", "CD4", "viral load",
  ];
  return hivTerms.some(term => text.includes(term));
}

// Shared expand helper — sorts longest key first, replaces first occurrence only.
function expandMap(text: string, map: Record<string, string>): string {
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  let result = text;
  for (const [abbr, full] of entries) {
    if (result.includes(full)) continue;
    const esc = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![A-Za-z0-9(])${esc}(?![A-Za-z0-9)])`, "");
    result = result.replace(re, full);
  }
  return result;
}

function expandAbbreviations(text: string): string {
  // Always expand safe medical/TB/clinical abbreviations
  let result = expandMap(text, MEDICAL_ABBREVIATIONS);
  // Only expand ARV drug names when response is in HIV/ART context
  if (isHIVResponse(result)) {
    result = expandMap(result, ARV_ABBREVIATIONS);
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
    parts.splice(refIdx);

    // Strip disclaimer/followup lines that got mixed into the refs block.
    // This happens when the model emits no blank line between the last
    // reference bullet and the disclaimer or follow-up prompt, so they
    // all land in one paragraph and splitResponse never sees them separately.
    // Strip the leading "- " or "* " or "• " before testing so we catch
    // both bare and bullet-wrapped forms: "⚠️ ..." and "- ⚠️ ...".
    const refLines = rawRefs.split("\n").filter(line => {
      const core = line.trim().replace(/^[-*•]\s*/, "");
      if (!disclaimer && DISCLAIMER_START_RE.test(core)) {
        disclaimer = STD_DISCLAIMER;
        return false;
      }
      if (!followup && FOLLOWUP_RE.test(core)) {
        followup = core;
        return false;
      }
      return true;
    });

    // Only expose refs if there are actual document-title list items after cleaning
    const cleaned = refLines.join("\n").trim();
    const normalized = cleaned ? deduplicateRefs(normalizeRefs(cleaned)) : "";
    refs = /^[-*•]\s/m.test(normalized) ? normalized : null;
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
  const { body, refs, disclaimer, followup } = useMemo(() => {
    console.log("[RAW RESPONSE START]");
    console.log(content);
    console.log("[RAW RESPONSE END]");
    return splitResponse(expandAbbreviations(cleanExtensions(cleanPlaceholderRefs(cleanCitationTokens(fixListBreaks(content))))));
  }, [content]);

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
