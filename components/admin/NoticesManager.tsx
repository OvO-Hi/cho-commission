"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  SaveStateContext,
  type SaveStateNotifier,
} from "@/components/admin/sample-blocks/save-state";
import { createClient } from "@/lib/supabase/client";
import type { CopyrightRule, Notice, NoticeSection } from "@/types/database";

import CopyrightRulesEditor from "./notices/CopyrightRulesEditor";

type Props = {
  initialNotices: Notice[];
  initialRules: CopyrightRule[];
};

const RICH_SECTIONS: { key: NoticeSection; label: string }[] = [
  { key: "intro", label: "자기소개" },
  { key: "notice", label: "공지사항" },
  { key: "refund", label: "환불 안내" },
];

export default function NoticesManager({
  initialNotices,
  initialRules,
}: Props) {
  const router = useRouter();

  // 1섹션 = 1행 정책. 같은 section 에 여러 row 가 있더라도 첫 번째만 사용.
  // 첫 저장 시 새 row 가 생기는 케이스(=비어있던 섹션)는 ref 로 id 를 추적.
  const initialMap = useMemo(() => {
    const m = new Map<string, Notice>();
    for (const n of initialNotices) {
      if (!m.has(n.section)) m.set(n.section, n);
    }
    return m;
  }, [initialNotices]);

  // 저장 후 새 row id 를 보존하기 위한 mutable ref. 다음 저장에서는 UPDATE.
  const sectionRowIdRef = useRef<Record<string, string | undefined>>({
    intro: initialMap.get("intro")?.id,
    notice: initialMap.get("notice")?.id,
    refund: initialMap.get("refund")?.id,
  });

  // 자동 저장 인디케이터 (SamplesManager 와 동일 패턴)
  const [saveState, setSaveState] =
    useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotifier: SaveStateNotifier = useMemo(
    () => ({
      notifySaving: () => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveState("saving");
      },
      notifySaved: () => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveState("saved");
        savedTimerRef.current = setTimeout(() => {
          setSaveState((s) => (s === "saved" ? "idle" : s));
        }, 2000);
      },
      notifyError: () => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveState("error");
      },
    }),
    [],
  );

  // 섹션별 onSave: 기존 row 가 있으면 UPDATE, 없으면 INSERT 후 id 보존.
  function makeSectionSave(section: NoticeSection) {
    return async (html: string) => {
      const supabase = createClient();
      const existingId = sectionRowIdRef.current[section];

      if (existingId) {
        const { error } = await supabase
          .from("notices")
          .update({ content: html })
          .eq("id", existingId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("notices")
          .insert({
            category: "common",
            section,
            title: "",
            content: html,
            order_num: 0,
            language: "ko",
          })
          .select()
          .single();
        if (error || !data) throw new Error(error?.message ?? "insert failed");
        sectionRowIdRef.current[section] = data.id;
      }
      router.refresh();
    };
  }

  return (
    <SaveStateContext.Provider value={saveNotifier}>
      <div className="admin-main-card">
        <div className="admin-notices-toolbar">
          <div>
            <h1 className="admin-main-title">공지 관리</h1>
            <p className="admin-notices-sub">
              Notice 페이지에 표시되는 텍스트와 저작권 표를 관리할 수 있어요
            </p>
          </div>
          <div
            className={`admin-samples-save-indicator admin-samples-save-${saveState}`}
            aria-live="polite"
          >
            {saveState === "saving" && "저장 중..."}
            {saveState === "saved" && "✓ 저장됨"}
            {saveState === "error" && "저장 실패"}
          </div>
        </div>

        <div className="admin-notices-sections">
          {/* 리치 텍스트 3섹션 */}
          {RICH_SECTIONS.map(({ key, label }) => {
            const initialContent = initialMap.get(key)?.content ?? "";
            return (
              <section key={key} className="admin-notices-section">
                <h2 className="admin-notices-section-title">{label}</h2>
                <RichTextEditor
                  // 섹션 단위 인스턴스 분리 (key) — initial content 가 다른 섹션과 섞이지 않게.
                  key={key}
                  value={initialContent}
                  onSave={makeSectionSave(key)}
                />
              </section>
            );
          })}

          {/* 저작권 범위 (별도 테이블 기반 표 편집기) */}
          <section className="admin-notices-section">
            <h2 className="admin-notices-section-title">저작권 범위</h2>
            <CopyrightRulesEditor initial={initialRules} />
          </section>
        </div>
      </div>
    </SaveStateContext.Provider>
  );
}
