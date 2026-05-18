"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  SaveStateContext,
  type SaveStateNotifier,
} from "@/components/admin/sample-blocks/save-state";
import { createClient } from "@/lib/supabase/client";
import { translateText } from "@/lib/i18n/translate-client";
import type {
  CopyrightColumn,
  CopyrightRule,
  CopyrightRuleValue,
  Language,
  Notice,
  NoticeSection,
} from "@/types/database";

import CopyrightRulesEditor from "./notices/CopyrightRulesEditor";

type Props = {
  initialNotices: Notice[];
  initialRules: CopyrightRule[];
  initialColumns: CopyrightColumn[];
  initialValues: CopyrightRuleValue[];
  locale: Language;
  aiTranslationEnabled: boolean;
};

const RICH_SECTIONS: { key: NoticeSection; label: string }[] = [
  { key: "intro", label: "자기소개" },
  { key: "notice", label: "공지사항" },
  { key: "refund", label: "환불 안내" },
];

type SectionDraft = Record<NoticeSection, string>;

function emptyDraft(): SectionDraft {
  return { intro: "", notice: "", refund: "", guide: "" } as SectionDraft;
}

export default function NoticesManager({
  initialNotices,
  initialRules,
  initialColumns,
  initialValues,
  locale,
  aiTranslationEnabled,
}: Props) {
  const router = useRouter();

  // 1섹션 = 1행 정책. 같은 section 에 여러 row 가 있더라도 첫 번째만 사용.
  const initialMap = useMemo(() => {
    const m = new Map<string, Notice>();
    for (const n of initialNotices) {
      if (!m.has(n.section)) m.set(n.section, n);
    }
    return m;
  }, [initialNotices]);

  // 각 섹션의 저장된 baseline (DB 마지막 저장값). RichTextEditor 의 initial content.
  const baseline: SectionDraft = useMemo(() => {
    const d = emptyDraft();
    for (const { key } of RICH_SECTIONS) {
      d[key] = initialMap.get(key)?.content ?? "";
    }
    return d;
  }, [initialMap]);

  // 사용자 편집 중인 현재 값 (자동저장 X — 저장 버튼 클릭 시 baseline 과 diff 해 일괄 PATCH).
  const [draft, setDraft] = useState<SectionDraft>(baseline);

  // 저장 후 새 row id 보존 (없던 섹션을 첫 저장하면 INSERT 후 id 가 생김).
  const sectionRowIdRef = useRef<Record<string, string | undefined>>({
    intro: initialMap.get("intro")?.id,
    notice: initialMap.get("notice")?.id,
    refund: initialMap.get("refund")?.id,
  });

  const dirtySections = useMemo(() => {
    return RICH_SECTIONS.filter(({ key }) => draft[key] !== baseline[key]).map(
      (s) => s.key,
    );
  }, [draft, baseline]);
  const dirty = dirtySections.length > 0;

  const [busy, setBusy] = useState(false);

  // 자동 저장 인디케이터 (SamplesManager 동일 패턴). 수동저장이지만 진행 상태 표시 용도.
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

  // 페이지 떠나려고 할 때 dirty 면 브라우저 경고. e.returnValue 는 빈 문자열이
  // 일부 브라우저(특히 구형 Chrome)에서 falsy 로 무시되어 prompt 가 안 뜨는 경우가
  // 있어 truthy 문자열을 명시. 현대 Chrome 은 이 문자열을 실제로 표시하지 않고
  // 자체 generic 메시지를 띄우지만, 값이 truthy 여야 prompt 가 트리거된다.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "변경사항이 저장되지 않았어요. 페이지를 떠나시겠어요?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function setSection(section: NoticeSection, html: string) {
    setDraft((prev) => ({ ...prev, [section]: html }));
  }

  // 한 섹션의 KO 저장 (INSERT or UPDATE). translation_key 는 같은 (category, section) 의 ko 따라감.
  async function persistSection(
    section: NoticeSection,
    html: string,
  ): Promise<void> {
    const supabase = createClient();
    const existingId = sectionRowIdRef.current[section];

    if (existingId) {
      const { error } = await supabase
        .from("notices")
        .update({ content: html })
        .eq("id", existingId);
      if (error) throw new Error(error.message);
      return;
    }
    const { data: koRow } = await supabase
      .from("notices")
      .select("translation_key")
      .eq("category", "common")
      .eq("section", section)
      .eq("language", "ko")
      .maybeSingle();
    const translationKey = koRow?.translation_key ?? crypto.randomUUID();

    const { data, error } = await supabase
      .from("notices")
      .insert({
        category: "common",
        section,
        title: "",
        content: html,
        order_num: 0,
        language: locale,
        translation_key: translationKey,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "insert failed");
    sectionRowIdRef.current[section] = data.id;
  }

  // 저장 버튼 클릭 — dirty 섹션 일괄 처리 + KO 탭이면 번역 다이얼로그 (변경된 섹션 단위).
  async function handleSaveAll() {
    if (!dirty || busy) return;
    setBusy(true);
    saveNotifier.notifySaving();

    // 1) dirty 섹션 모두 KO save (병렬)
    const sectionsToTranslate: { section: NoticeSection; html: string }[] = [];
    try {
      await Promise.all(
        dirtySections.map(async (key) => {
          const html = draft[key];
          await persistSection(key, html);
          sectionsToTranslate.push({ section: key, html });
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      console.error("[admin/notices] save failed:", msg);
      saveNotifier.notifyError();
      setBusy(false);
      alert(`저장 중 오류가 발생했어요.\n(${msg})`);
      return;
    }

    saveNotifier.notifySaved();
    // baseline 동기화 — 다음 dirty 계산 기준이 새 저장값.
    // router.refresh() 가 새 props 로 baseline 을 갱신해주지만, 동기화 시점 race 방지로 즉시 적용.

    // 2) KO 탭 + 토글 ON 이면 변경된 섹션들에 대해 다이얼로그 (한 섹션씩 순차).
    if (locale === "ko" && aiTranslationEnabled && sectionsToTranslate.length > 0) {
      for (const { section, html } of sectionsToTranslate) {
        await offerTranslationAfterKoSave(section, html);
      }
    }

    setBusy(false);
    router.refresh();
  }

  // KO 저장 직후 호출. 같은 translation_key 의 EN/JP row 가 있으면 "덮어쓰기" 다이얼로그.
  async function offerTranslationAfterKoSave(
    section: NoticeSection,
    koContent: string,
  ) {
    const supabase = createClient();

    const { data: koRow, error: koErr } = await supabase
      .from("notices")
      .select("translation_key")
      .eq("category", "common")
      .eq("section", section)
      .eq("language", "ko")
      .maybeSingle();
    if (koErr || !koRow) {
      console.error("[admin/notices] ko row lookup failed:", koErr?.message);
      return;
    }
    const translationKey = koRow.translation_key;

    const { data: siblings, error: sibErr } = await supabase
      .from("notices")
      .select("id, language")
      .eq("translation_key", translationKey)
      .neq("language", "ko");
    if (sibErr) {
      console.error("[admin/notices] sibling lookup failed:", sibErr.message);
      return;
    }
    const existingByLang = new Map<string, string>();
    for (const r of siblings ?? []) existingByLang.set(r.language, r.id);
    const siblingCount = existingByLang.size;

    const sectionLabel =
      RICH_SECTIONS.find((s) => s.key === section)?.label ?? section;
    const proceed =
      siblingCount > 0
        ? window.confirm(
            `"${sectionLabel}" 의 영어/일본어 번역본 ${siblingCount}개를 새로 번역하시겠어요?\n\n` +
              `기존 번역본을 덮어씁니다. AI 번역 비용이 발생합니다.\n\n` +
              `[확인] 예, 새로 번역\n[취소] 아니오, 한국어만`,
          )
        : window.confirm(
            `"${sectionLabel}" 의 영어/일본어 번역본도 만드시겠어요?\n\n` +
              `AI 번역 비용이 발생합니다.\n\n` +
              `[확인] 예, 번역할게요\n[취소] 아니오, 한국어만`,
          );
    if (!proceed) return;

    saveNotifier.notifySaving();
    let translations: Partial<Record<"en" | "jp", string>>;
    try {
      const result = await translateText(koContent, ["en", "jp"], "공지사항");
      translations = result.translations;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      console.error("[admin/notices] translate failed:", msg);
      saveNotifier.notifyError();
      alert(`번역에 실패했어요. 한국어는 그대로 저장됐어요.\n(${msg})`);
      return;
    }

    const results = await Promise.all(
      (["en", "jp"] as const).map(async (lang) => {
        const value = translations[lang];
        if (!value) return { error: null };
        const existingRowId = existingByLang.get(lang);
        if (existingRowId) {
          return supabase
            .from("notices")
            .update({ content: value })
            .eq("id", existingRowId);
        }
        return supabase.from("notices").insert({
          category: "common",
          section,
          title: "",
          content: value,
          order_num: 0,
          language: lang,
          translation_key: translationKey,
        });
      }),
    );
    const failed = results.find((r) => r.error);
    if (failed) {
      console.error(
        "[admin/notices] translation save failed:",
        failed.error?.message,
      );
      saveNotifier.notifyError();
      alert("번역 결과 저장에 실패했어요.");
      return;
    }

    saveNotifier.notifySaved();
    alert(
      siblingCount > 0
        ? `"${sectionLabel}" 의 영어/일본어 번역본이 업데이트됐어요.`
        : `"${sectionLabel}" 의 영어/일본어 번역본이 추가됐어요.`,
    );
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
            className={`admin-samples-save-indicator admin-samples-save-${saveState}${
              saveState === "idle" && dirty ? " admin-samples-save-dirty" : ""
            }`}
            aria-live="polite"
          >
            {saveState === "saving" && "저장 중..."}
            {saveState === "saved" && "✓ 저장됨"}
            {saveState === "error" && "저장 실패"}
            {saveState === "idle" && dirty &&
              `● 저장되지 않은 변경사항 ${dirtySections.length}개`}
          </div>
        </div>

        <div className="admin-notices-sections">
          {/* 리치 텍스트 3섹션. 수동저장 — 부모가 dirty 추적, 저장 버튼 한 번에 처리. */}
          {RICH_SECTIONS.map(({ key, label }) => {
            return (
              <section key={key} className="admin-notices-section">
                <h2 className="admin-notices-section-title">{label}</h2>
                <RichTextEditor
                  key={key}
                  value={baseline[key]}
                  autoSave={false}
                  onChange={(html) => setSection(key, html)}
                />
              </section>
            );
          })}

          <div className="admin-notices-save-bar">
            <button
              type="button"
              className="admin-action-btn admin-action-btn-primary"
              onClick={handleSaveAll}
              disabled={!dirty || busy}
            >
              {busy ? "저장 중..." : "저장"}
            </button>
          </div>

          {/* 저작권 범위 (별도 테이블 기반 표 편집기) */}
          <section className="admin-notices-section">
            <h2 className="admin-notices-section-title">저작권 범위</h2>
            <CopyrightRulesEditor
              initialRules={initialRules}
              initialColumns={initialColumns}
              initialValues={initialValues}
              locale={locale}
            />
          </section>
        </div>
      </div>
    </SaveStateContext.Provider>
  );
}
