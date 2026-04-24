import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: false });

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1","h2","h3","h4","h5","h6",
    "p","blockquote","ul","ol","li",
    "strong","em","del","code","pre","hr","br",
    "a","img","table","thead","tbody","tr","th","td",
    "span","div",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title"],
    code: ["class"],
    span: ["class"],
    div: ["class"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
  },
};

export async function renderMarkdownSafe(md: string): Promise<string> {
  const html = await marked.parse(md);
  return sanitizeHtml(html, SANITIZE_OPTS);
}
