import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
`;

let styleInjected = false;
function injectStyles() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = LIST_CSS;
  document.head.appendChild(el);
}

export function MarkdownMessage({ content }: { content: string }) {
  injectStyles();
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          ul: ({ children }) => <ul>{children}</ul>,
          ol: ({ children }) => <ol>{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h1>{children}</h1>,
          h2: ({ children }) => <h2>{children}</h2>,
          h3: ({ children }) => <h3>{children}</h3>,
          code: ({ children }) => <code>{children}</code>,
          pre: ({ children }) => <pre>{children}</pre>,
          blockquote: ({ children }) => <blockquote>{children}</blockquote>,
          hr: () => <hr />,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
