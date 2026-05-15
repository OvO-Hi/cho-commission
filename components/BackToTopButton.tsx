"use client";

import { useEffect, useState } from "react";

// 우측 하단 "맨 위로" 버튼. scrollY > 400px 일 때만 노출.
// opacity transition 은 CSS 에서 유지 (등장/사라짐 부드럽게).
export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let rafId: number | null = null;

    function update() {
      setVisible(window.scrollY > 400);
      rafId = null;
    }

    function onScroll() {
      if (rafId == null) {
        rafId = requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <button
      type="button"
      className={`back-to-top${visible ? " back-to-top-visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="맨 위로"
    >
      <span className="back-to-top-arrow" aria-hidden>
        ↑
      </span>
      <span className="back-to-top-text">TOP</span>
    </button>
  );
}
