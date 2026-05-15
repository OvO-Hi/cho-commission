"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SETTING_KEYS } from "@/lib/admin/setting-keys";
import { createClient } from "@/lib/supabase/client";

type SettingsState = {
  intro: string;
  snsX: string;
  snsEmail: string;
};

type Props = {
  initial: SettingsState;
};

export default function SettingsManager({ initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SettingsState>(initial);
  // 저장 완료된 시점의 스냅샷 — dirty 비교용. 저장 후 현재 상태로 갱신.
  const [snapshot, setSnapshot] = useState<SettingsState>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 서버가 router.refresh() 로 재요청되면 새 initial 로 동기화.
  useEffect(() => {
    setState(initial);
    setSnapshot(initial);
  }, [initial]);

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
      fields.map(async ({ key, value }) => {
        const { data: existing } = await supabase
          .from("settings")
          .select("id")
          .eq("key", key)
          .eq("language", "ko")
          .maybeSingle();

        if (existing) {
          return supabase
            .from("settings")
            .update({ value })
            .eq("id", existing.id);
        }
        return supabase
          .from("settings")
          .insert({ key, value, language: "ko" });
      }),
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
    router.refresh();
  }

  function showToast(msg: string) {
    setToast(msg);
    // 토스트 자동 사라짐. 새 토스트가 들어오면 setState 로 자연 갱신되므로 별도 cleanup 불필요.
    setTimeout(() => {
      setToast((current) => (current === msg ? null : current));
    }, 2500);
  }

  return (
    <form className="admin-main-card" onSubmit={handleSubmit}>
      <h1 className="admin-main-title">사이트 설정</h1>
      <p className="admin-settings-sub">
        메인 페이지에 표시되는 정보를 수정할 수 있어요
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
