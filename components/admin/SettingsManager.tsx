"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SETTING_KEYS } from "@/lib/admin/setting-keys";
import { createClient } from "@/lib/supabase/client";
import { translateText } from "@/lib/i18n/translate-client";
import type { Language } from "@/types/database";

// 어드민이 현재 어떤 locale 탭에 있는지 시각화. 다른 매니저(Notices/Process 등)
// 와 톤 일관. sidebar 의 LanguageToggle 로 locale 전환 → 각 탭에서 그 언어의
// 값이 입력/저장된다.
const LOCALE_BADGE: Record<Language, string> = {
  ko: "KO",
  en: "EN",
  jp: "JP",
};

// AI 번역 일괄 적용 시, 텍스트는 번역하고 핸들/이메일은 원본 복제.
// snsX/snsEmail 은 언어와 무관한 식별자라 번역 대상 X.
const TRANSLATABLE_KEYS: ReadonlySet<string> = new Set([SETTING_KEYS.intro]);

type SettingsState = {
  intro: string;
  snsX: string;
  snsEmail: string;
};

type Props = {
  initial: SettingsState;
  locale: Language;
  aiTranslationEnabled: boolean;
};

export default function SettingsManager({
  initial,
  locale,
  aiTranslationEnabled,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<SettingsState>(initial);
  // 저장 완료된 시점의 스냅샷 — dirty 비교용. 저장 후 현재 상태로 갱신.
  const [snapshot, setSnapshot] = useState<SettingsState>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI 자동 번역 토글: 글로벌 설정이라 form-submit 흐름과 분리. 변경 즉시 저장.
  const [aiToggle, setAiToggle] = useState(aiTranslationEnabled);
  const [aiToggleBusy, setAiToggleBusy] = useState(false);

  // 서버가 router.refresh() 로 재요청되면 새 initial 로 동기화.
  useEffect(() => {
    setState(initial);
    setSnapshot(initial);
  }, [initial]);

  useEffect(() => {
    setAiToggle(aiTranslationEnabled);
  }, [aiTranslationEnabled]);

  const dirty =
    state.intro !== snapshot.intro ||
    state.snsX !== snapshot.snsX ||
    state.snsEmail !== snapshot.snsEmail;

  function update<K extends keyof SettingsState>(key: K, value: string) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty || saving) return;

    setSaving(true);
    setError(null);

    const supabase = createClient();

    // 변경된 필드만 골라 upsert (settings 의 select-then-update-or-insert 패턴).
    const fields: { key: string; value: string; was: string }[] = [
      { key: SETTING_KEYS.intro, value: state.intro, was: snapshot.intro },
      { key: SETTING_KEYS.snsX, value: state.snsX, was: snapshot.snsX },
      {
        key: SETTING_KEYS.snsEmail,
        value: state.snsEmail,
        was: snapshot.snsEmail,
      },
    ].filter((f) => f.value !== f.was);

    const results = await Promise.all(
      fields.map(({ key, value }) =>
        upsertSettingForLocale(supabase, key, value, locale),
      ),
    );

    setSaving(false);

    const failed = results.find((r) => r.error);
    if (failed) {
      console.error("[admin/settings] save failed:", failed.error?.message);
      setError("저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setSnapshot(state);
    showToast("저장되었어요");

    // KO 탭 + 글로벌 AI 토글 ON 이면 변경된 텍스트 일괄 번역 다이얼로그.
    // 다른 매니저(ProcessManager/NoticesManager 등) 와 동일한 패턴.
    if (locale === "ko" && aiToggle && fields.length > 0) {
      await offerBulkTranslation(fields);
    }

    router.refresh();
  }

  // KO 변경분에 대해 EN/JP 번역 제안 → 확인 시 translateText 호출 후 per-locale upsert.
  async function offerBulkTranslation(
    fields: { key: string; value: string }[],
  ) {
    // intro 처럼 번역 의미 있는 필드만 카운트. snsX/snsEmail 은 번역 대상 아님.
    const translatableFields = fields.filter((f) =>
      TRANSLATABLE_KEYS.has(f.key),
    );
    if (translatableFields.length === 0) return;

    const proceed = window.confirm(
      `변경된 항목 ${translatableFields.length}개의 영어/일본어 번역본도 만드시겠어요?\n\n` +
        `AI 번역 비용이 발생합니다.\n\n` +
        `[확인] 예, 번역할게요\n[취소] 아니오, 한국어만`,
    );
    if (!proceed) return;

    setSaving(true);
    const supabase = createClient();
    let successCount = 0;
    let failCount = 0;

    for (const field of translatableFields) {
      try {
        const result = await translateText(
          field.value,
          ["en", "jp"],
          "사이트 메인 페이지 하단 소개글",
        );
        for (const lang of ["en", "jp"] as const) {
          const translated = result.translations[lang] ?? field.value;
          const { error: e } = await upsertSettingForLocale(
            supabase,
            field.key,
            translated,
            lang,
          );
          if (e) throw new Error(e.message);
        }
        successCount++;
      } catch (e) {
        failCount++;
        const msg = e instanceof Error ? e.message : "unknown error";
        console.error(
          `[admin/settings] translation failed for key ${field.key}:`,
          msg,
        );
      }
    }

    setSaving(false);
    if (failCount > 0) {
      showToast(`${successCount}개 번역 성공, ${failCount}개 실패`);
    } else {
      showToast(`${successCount}개 번역 완료`);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    // 토스트 자동 사라짐. 새 토스트가 들어오면 setState 로 자연 갱신되므로 별도 cleanup 불필요.
    setTimeout(() => {
      setToast((current) => (current === msg ? null : current));
    }, 2500);
  }

  // AI 자동 번역 토글 — 변경 즉시 저장. 글로벌 설정이라 language='ko' row 만 사용.
  async function persistAiToggle(next: boolean) {
    if (aiToggleBusy) return;
    setAiToggle(next); // 낙관적 업데이트
    setAiToggleBusy(true);
    const supabase = createClient();
    const key = SETTING_KEYS.aiTranslationEnabled;
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("key", key)
      .eq("language", "ko")
      .maybeSingle();
    const result = existing
      ? await supabase
          .from("settings")
          .update({ value: String(next) })
          .eq("id", existing.id)
      : await supabase.from("settings").insert({
          key,
          value: String(next),
          language: "ko",
          translation_key: crypto.randomUUID(),
        });
    setAiToggleBusy(false);
    if (result.error) {
      console.error(
        "[admin/settings] ai toggle save failed:",
        result.error.message,
      );
      setAiToggle(!next); // 롤백
      setError("AI 번역 설정 저장에 실패했어요.");
      return;
    }
    showToast(next ? "AI 자동 번역이 켜졌어요" : "AI 자동 번역이 꺼졌어요");
    router.refresh();
  }

  return (
    <form className="admin-main-card" onSubmit={handleSubmit}>
      <h1 className="admin-main-title">
        사이트 설정{" "}
        <span className="admin-locale-badge" aria-label={`현재 ${LOCALE_BADGE[locale]} 탭`}>
          {LOCALE_BADGE[locale]}
        </span>
      </h1>
      <p className="admin-settings-sub">
        메인 페이지에 표시되는 정보를 수정할 수 있어요. 좌측 상단 언어 토글로
        EN/JP 탭으로 전환해 각 언어의 값을 따로 입력할 수 있어요.
      </p>

      <div className="admin-settings-fields">
        <Field
          id="setting-intro"
          label="메인 페이지 하단 소개글"
          hint="사이트 하단 'LIVE2D | VTUBER | ILLUSTRATION' 아래에 표시되는 소개 문구입니다"
        >
          <textarea
            id="setting-intro"
            className="admin-form-input admin-settings-textarea"
            rows={3}
            value={state.intro}
            onChange={(e) => update("intro", e.target.value)}
          />
        </Field>

        <Field
          id="setting-sns-x"
          label="X(Twitter) 계정"
          hint="예: @cho__913"
        >
          <input
            id="setting-sns-x"
            type="text"
            className="admin-form-input"
            value={state.snsX}
            onChange={(e) => update("snsX", e.target.value)}
          />
        </Field>

        <Field
          id="setting-sns-email"
          label="이메일"
          hint="예: chocano8913@gmail.com"
        >
          <input
            id="setting-sns-email"
            type="email"
            className="admin-form-input"
            value={state.snsEmail}
            onChange={(e) => update("snsEmail", e.target.value)}
          />
        </Field>

        {/* AI 자동 번역 토글 — 위 form 의 submit 흐름과 분리 (변경 즉시 저장).
            input type=checkbox 는 Enter 가 닿지 않는 한 form submit 을 트리거하지 않음. */}
        <div className="admin-settings-field admin-settings-toggle-field">
          <label
            htmlFor="setting-ai-translation"
            className="admin-settings-toggle-label"
          >
            <input
              id="setting-ai-translation"
              type="checkbox"
              className="admin-settings-toggle-input"
              checked={aiToggle}
              disabled={aiToggleBusy}
              onChange={(e) => persistAiToggle(e.target.checked)}
            />
            <span>AI 자동 번역 사용</span>
          </label>
          <p className="admin-settings-hint">
            공지나 가격 등 KO 내용을 수정하실 때, AI 가 EN/JP 자동 번역해드릴지
            매번 안내창이 뜹니다. AI API 사용료가 별도 발생합니다.
          </p>
        </div>
      </div>

      <div className="admin-settings-footer">
        {/* 토스트 / 에러 메시지를 저장 버튼 좌측에 배치해 시선을 함께 묶어줍니다. */}
        {error ? (
          <span className="admin-settings-toast admin-settings-toast-err">
            {error}
          </span>
        ) : toast ? (
          <span className="admin-settings-toast">{toast}</span>
        ) : null}
        <button
          type="submit"
          className="admin-action-btn admin-action-btn-primary"
          disabled={!dirty || saving}
        >
          {saving ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-settings-field">
      <label htmlFor={id} className="admin-settings-label">
        {label}
      </label>
      <p className="admin-settings-hint">{hint}</p>
      {children}
    </div>
  );
}

// settings 한 (key, locale) 쌍에 대해 upsert. row 가 있으면 update, 없으면 INSERT.
// 새 row INSERT 시 같은 key 의 ko row 의 translation_key 를 재사용해 번역 그룹을 유지.
async function upsertSettingForLocale(
  supabase: ReturnType<typeof createClient>,
  key: string,
  value: string,
  targetLocale: Language,
) {
  const { data: existing } = await supabase
    .from("settings")
    .select("id")
    .eq("key", key)
    .eq("language", targetLocale)
    .maybeSingle();

  if (existing) {
    return supabase
      .from("settings")
      .update({ value })
      .eq("id", existing.id);
  }

  const { data: koRow } = await supabase
    .from("settings")
    .select("translation_key")
    .eq("key", key)
    .eq("language", "ko")
    .maybeSingle();

  const translationKey = koRow?.translation_key ?? crypto.randomUUID();

  return supabase
    .from("settings")
    .insert({ key, value, language: targetLocale, translation_key: translationKey });
}
