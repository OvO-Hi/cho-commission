"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setLocaleCookie } from "@/lib/i18n/locale-actions";
import type { Language } from "@/types/database";

// 사용자 페이지 우상단 언어 토글. server component 가 현재 locale 을 prop 으로 넘겨주고,
// 선택 시 setLocaleCookie (server action) + router.refresh 로 같은 페이지를 재렌더.
//
// 4곳에서 import: app/page.tsx (메인), app/notice, app/live2d, app/illust.
// 드롭다운 위치는 부모 .lang-menu 기준 absolute — 4페이지 모두 동일 동작.

const OPTIONS: { value: Language; label: string }[] = [
  { value: "ko", label: "KO" },
  { value: "en", label: "EN" },
  { value: "jp", label: "JP" },
];

export default function LanguageToggle({ current }: { current: Language }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 / ESC 로 닫기.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: Language) {
    setOpen(false);
    if (next === current) return;
    // server action 후 refresh — 서버 컴포넌트가 새 cookie 로 다시 fetch.
    startTransition(async () => {
      await setLocaleCookie(next);
      router.refresh();
    });
  }

  return (
    <div className="lang-menu" ref={rootRef}>
      <button
        type="button"
        className="lang-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={pending}
      >
        {current.toUpperCase()} ∨
      </button>
      {open && (
        <ul className="lang-dropdown" role="listbox">
          {OPTIONS.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className={`lang-dropdown-item${
                  o.value === current ? " is-current" : ""
                }`}
                onClick={() => pick(o.value)}
                role="option"
                aria-selected={o.value === current}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
