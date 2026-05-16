// 사용자 페이지에서 현재 노출 언어를 결정하는 server-only 헬퍼.
// 쿠키 'locale' 이 있으면 그 값, 없으면 'ko'.
//
// 쓰기(setLocaleCookie)는 server action 으로 분리되어 lib/i18n/locale-actions.ts
// 에 있다. client component(LanguageToggle) 가 cookies() 까지 모듈 그래프로
// 따라오는 webpack 오류를 피하기 위함.

import { cookies } from "next/headers";
import type { Language } from "@/types/database";

const LOCALE_COOKIE = "locale";
const SUPPORTED_LOCALES: readonly Language[] = ["ko", "en", "jp"] as const;
export const DEFAULT_LOCALE: Language = "ko";

function isLanguage(value: string | undefined): value is Language {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Server Component 에서 호출. next/headers 의 cookies() 는 동기 API 이지만,
// 향후 Next 가 비동기로 바꿀 여지를 고려해 Promise 시그니처로 둔다.
export async function getCurrentLocale(): Promise<Language> {
  const store = cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLanguage(value) ? value : DEFAULT_LOCALE;
}
