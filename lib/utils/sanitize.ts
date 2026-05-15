import sanitizeHtml from "sanitize-html";

// 사이트 전체에서 사용자 콘텐츠를 sanitize 할 때 공유하는 옵션.
//   - tiptap 의 기본 출력(p / br / strong / em / u / h1~h3 / ul / ol / li) 허용
//   - inline style 은 text-align(left|right|center|justify) 만 허용
//   - href / src 등 위험 속성은 default 로 차단
export const RICH_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
  ],
  allowedAttributes: {
    "*": ["style"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
    },
  },
};

export function sanitizeRich(html: string): string {
  return sanitizeHtml(html, RICH_SANITIZE_OPTIONS);
}
