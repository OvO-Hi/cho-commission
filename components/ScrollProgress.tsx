"use client";

import { useEffect, useState } from "react";

// 우측 세로 스크롤 진행도 막대.
// 모바일 (< 768px) 에서는 CSS 가 숨김.
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId: number | null = null;

    function update() {
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const ratio =
        docHeight > 0
          ? Math.min(1, Math.max(0, window.scrollY / docHeight))
          : 0;
      setProgress(ratio);
      rafId = null;
    }

    function onScroll() {
      // 한 프레임에 update 가 이미 예약돼 있으면 스킵 (cancel-and-reschedule 보다 약간 더 가벼움).
      if (rafId == null) {
        rafId = requestAnimationFrame(update);
      }
    }

    update(); // 초기 동기화
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="scroll-progress" aria-hidden>
      {/* CSS transition 없음 — 매 프레임 inline height 가 즉시 반영. */}
      <div
        className="scroll-progress-bar"
        style={{ height: `${progress * 100}%` }}
      />
    </div>
  );
}
