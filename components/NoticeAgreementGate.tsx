"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Info } from "lucide-react";

import { getFormMessages } from "@/lib/i18n/form-messages";
import type { Language } from "@/types/database";

// 신청 폼 위에 강제 동의 게이트를 얹는 wrapper.
// 체크박스 OFF: children 영역이 흐릿 + pointer 차단 (입력 value 는 보존 — 시각/상호작용만 막음).
// 체크박스 ON : children 영역이 부드럽게 활성화.
//
// 키보드 접근까지 차단하려면 inert 속성을 쓰는 게 더 단단하지만, React 18 의
// prop 지원이 18.3+ 라 호환성 회피. 마우스/터치 차단으로 명세 충족.
export default function NoticeAgreementGate({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Language;
}) {
  const [agreed, setAgreed] = useState(false);
  const messages = getFormMessages(locale);

  return (
    <div className="notice-gate">
      <aside
        className={`notice-gate-card${agreed ? " is-agreed" : ""}`}
        role="region"
        aria-label={messages.pre_check_title}
      >
        <div className="notice-gate-icon" aria-hidden="true">
          <Info size={22} />
        </div>
        <div className="notice-gate-body">
          <h3 className="notice-gate-title">{messages.pre_check_title}</h3>
          <p className="notice-gate-text">{messages.pre_check_desc}</p>
          <Link href="/notice" className="notice-gate-link">
            📋 {messages.view_notice} →
          </Link>
          <label className="notice-gate-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-label={messages.notice_agree}
            />
            <span>{messages.notice_agree}</span>
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
