// 'use client' 지시자 없음 — 사용자 페이지(서버 컴포넌트) 와 어드민 미리보기 모달
// (클라이언트 컴포넌트) 양쪽에서 공유하는 순수 표현 컴포넌트.
// 서버 전용 API(cookies, fetch with revalidate 등) 사용 금지.

import ScrollReveal from "@/components/ScrollReveal";
import { sanitizeRich } from "@/lib/utils/sanitize";
import { extractYouTubeVideoId } from "@/lib/utils/youtube";
import type { SampleBlock, SampleImage } from "@/types/database";

// 블록과 그 자식 이미지를 함께 묶은 형태. 호출자(server page / SamplesManager)가
// fetch 결과를 미리 join 해서 전달합니다.
export type SampleBlockWithImages = SampleBlock & {
  images: SampleImage[];
};

type Props = {
  blocks: SampleBlockWithImages[];
};

// 빈 콘텐츠 블록(예: 텍스트 비어있음, URL 미입력) 은 사용자 화면에서 제외.
// 어드민 작업 중 미완성 블록이 그대로 노출되지 않도록 함.
function isRenderable(b: SampleBlockWithImages): boolean {
  switch (b.block_type) {
    case "text":
      return !!b.text_content?.trim();
    case "youtube":
      return !!extractYouTubeVideoId(b.youtube_url ?? "");
    case "image_row":
      return b.images.length > 0;
    case "divider":
      return true;
    default:
      return false;
  }
}

export default function SamplePageRenderer({ blocks }: Props) {
  const renderable = blocks.filter(isRenderable);

  if (renderable.length === 0) {
    return <p className="sample-empty">준비 중입니다</p>;
  }

  return (
    <div className="sample-page">
      {renderable.map((b, idx) => {
        const node = <SampleBlockNode block={b} />;
        // 첫 두 블록은 페이지 진입 시 즉시 보여야 자연스러우므로 wrap 안 함.
        if (idx <= 1) return <div key={b.id}>{node}</div>;
        return <ScrollReveal key={b.id}>{node}</ScrollReveal>;
      })}
    </div>
  );
}

function SampleBlockNode({ block: b }: { block: SampleBlockWithImages }) {
  if (b.block_type === "text") {
    // text_content 는 이제 tiptap 의 HTML 출력. 옛 단순 텍스트(태그 없음) 도 처리.
    const html = renderTextToHtml(b.text_content ?? "");
    return (
      <div
        className="sample-text"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  if (b.block_type === "youtube") {
    const videoId = extractYouTubeVideoId(b.youtube_url ?? "");
    if (!videoId) return null;
    return (
      <div className="sample-youtube">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube 영상"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (b.block_type === "image_row") {
    const sorted = [...b.images].sort((a, c) => a.order_num - c.order_num);
    const totalRatio =
      sorted.reduce((s, i) => s + i.width_ratio, 0) || 1;
    const height = b.row_height ?? 200;
    return (
      <div className="sample-image-row" style={{ height }}>
        {sorted.map((img) => (
          <div
            key={img.id}
            className="sample-image-cell"
            style={{
              flexGrow: img.width_ratio / totalRatio,
              flexBasis: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.image_url} alt="" />
          </div>
        ))}
      </div>
    );
  }
  if (b.block_type === "divider") {
    return <hr className="sample-divider" />;
  }
  return null;
}

// 텍스트 블록 콘텐츠 → 안전한 HTML.
//   - HTML 태그가 들어있으면 (tiptap 출력) DOMPurify 로 sanitize 만 수행
//   - 태그가 없으면 (옛 단순 텍스트) escape + \n→<br> + <p> 감싸기
const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

function renderTextToHtml(content: string): string {
  if (!content) return "";
  if (HTML_TAG_RE.test(content)) {
    return sanitizeRich(content);
  }
  // 단순 텍스트: HTML escape + 줄바꿈 보존
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
  return sanitizeRich(`<p>${escaped}</p>`);
}
