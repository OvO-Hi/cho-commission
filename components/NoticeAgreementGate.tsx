"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Info } from "lucide-react";

// 다른 사용자 페이지 텍스트가 모두 ko 하드코딩이라 동일 규약. 향후 i18n 도입 시
// 이 상수만 외부로 빼면 된다.
const TEXT = {
  title: "신청 전 확인해주세요",
  body: "원활한 작업과 분쟁 방지를 위해, 신청 전 공지사항을 반드시 확인해주세요.",
  cta: "📋 공지사항 보러 가기",
  agree: "공지사항을 모두 확인했으며, 동의합니다",
};

// 신청 폼 위에 강제 동의 게이트를 얹는 wrapper.
// 체크박스 OFF: children 영역이 흐릿 + pointer 차단 (입력 value 는 보존 — 시각/상호작용만 막음).
// 체크박스 ON : children 영역이 부드럽게 활성화.
//
// 키보드 접근까지 차단하려면 inert 속성을 쓰는 게 더 단단하지만, React 18 의
// prop 지원이 18.3+ 라 호환성 회피. 마우스/터치 차단으로 명세 충족.
export default function NoticeAgreementGate({ children }: { children: ReactNode }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="notice-gate">
      <aside
        className={`notice-gate-card${agreed ? " is-agreed" : ""}`}
        role="region"
        aria-label={TEXT.title}
      >
        <div className="notice-gate-icon" aria-hidden="true">
          <Info size={22} />
        </div>
        <div className="notice-gate-body">
          <h3 className="notice-gate-title">{TEXT.title}</h3>
          <p className="notice-gate-text">{TEXT.body}</p>
          <Link href="/notice" className="notice-gate-link">
            {TEXT.cta} →
          </Link>
          <label className="notice-gate-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-label={TEXT.agree}
            />
            <span>{TEXT.agree}</span>
          </label>
        </div>
      </aside>

      <div
        className={`notice-gate-content${agreed ? " is-enabled" : ""}`}
        aria-disabled={!agreed}
      >
        {children}
      </div>
    </div>
  );
}
