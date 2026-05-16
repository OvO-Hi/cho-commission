// 사용자 페이지에서 현재 노출 언어를 결정하는 헬퍼.
//
// 이번 PR 범위: 헬퍼 인터페이스만 도입. KO ∨ 토글의 onClick 연결과,
// 다른 사용자 페이지들의 language="ko" 하드코딩을 getCurrentLocale 로 일괄 치환하는
// 작업은 후속 PR 로 분리. (현재 다른 테이블에 en/jp row 데이터가 없어서 토글이
// 동작해도 페이지가 비어 보이는 문제가 있고, 그 데이터/페이지 fallback 정리가
// copyright PR 범위를 한참 넘어가기 때문.)
//
// 현재 동작: 쿠키 'locale' 이 있으면 그 값, 없으면 'ko'.
// copyright_rules 사용자 페이지가 이 헬퍼를 첫 사용처가 된다.

import { cookies } from "next/headers";
import type { Language } from "@/types/database";

const LOCALE_COOKIE = "locale";
const SUPPORTED_LOCALES: readonly Language[] = ["ko", "en", "jp"] as const;
export const DEFAULT_LOCALE: Language = "ko";

// 쿠키 1년 유지. 토글이 동작하기 시작하면 사용자가 한 번 고른 언어를
// 다음 방문에도 재사용하도록.
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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

// Server Action 으로 호출하기 위한 함수. 호출부에서 form action 또는
// startTransition 안에서 사용. 잘못된 값이 오면 무시.
//
// Note: server action 으로 노출하려면 호출하는 모듈이 "use server" 컨텍스트여야
// 한다. 이 모듈 전체를 server-only 로 두면 클라 import 가 빌드 오류를 내므로,
// 함수 단위 디렉티브를 사용한다.
export async function setLocaleCookie(next: Language): Promise<void> {
  "use server";
  if (!isLanguage(next)) return;
  cookies().set({
    name: LOCALE_COOKIE,
    value: next,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}
