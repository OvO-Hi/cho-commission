// 어드민 client 측에서 /api/translate 를 호출하는 헬퍼.
// 다음 commit 에서 NoticesManager 등의 다이얼로그가 이 함수를 호출.
//
// fetch 만 wrap 하고, 에러는 명시적인 메시지로 throw 한다 — 호출부가 catch 해서
// 토스트/모달 표시 등을 처리.

import type { Language } from "@/types/database";

export type TranslationTarget = Exclude<Language, "ko">; // "en" | "jp"

export type TranslateResult = {
  translations: Partial<Record<TranslationTarget, string>>;
  usage?: { input_tokens: number; output_tokens: number };
};

export async function translateText(
  text: string,
  targetLocales: TranslationTarget[],
  context?: string,
): Promise<TranslateResult> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLocales, context }),
  });

  if (!res.ok) {
    let errMsg = `translation failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) errMsg = body.error;
    } catch {
      // body 없거나 JSON 아님 — status 기반 메시지 그대로 사용
    }
    // 401 → 어드민 세션 만료 케이스. 호출부가 구분하고 싶으면 res.status 로.
    throw new Error(errMsg);
  }

  return (await res.json()) as TranslateResult;
}
