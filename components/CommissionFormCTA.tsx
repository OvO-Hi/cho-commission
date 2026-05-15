"use client";

import { useEffect, useState } from "react";

type Props = {
  // 신청폼 섹션의 element id. 이 요소가 뷰포트 안에 있으면 CTA 자동 숨김.
  targetId: string;
};

export default function CommissionFormCTA({ targetId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 신청폼이 보이지 않으면 CTA 표시.
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  function handleClick() {
    const target = document.getElementById(targetId);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button
      type="button"
      className={`form-cta${visible ? " form-cta-visible" : ""}`}
      onClick={handleClick}
      aria-label="신청서로 이동"
    >
      📝 신청서 작성하기 ↓
    </button>
  );
}
