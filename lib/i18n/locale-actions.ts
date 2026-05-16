// 사용자 페이지에서 호출하는 서버 액션. LanguageToggle (client component) 가
// 이 모듈을 import 해 setLocaleCookie 를 호출한다.
//
// 파일 상단 "use server" 가 있으면 이 파일의 모든 export 가 server action 으로 처리되어
// 클라 번들에는 stub 만 포함된다. lib/i18n/locale.ts 는 next/headers 의 cookies 를
// 동기 호출하기 때문에 server-only 라 클라가 import 하면 webpack 오류 — 그래서 액션을
// 분리한다.

"use server";

import { cookies } from "next/headers";
import type { Language } from "@/types/database";

const LOCALE_COOKIE = "locale";
const SUPPORTED_LOCALES: readonly Language[] = ["ko", "en", "jp"] as const;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isLanguage(value: string): value is Language {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export async function setLocaleCookie(next: Language): Promise<void> {
  if (!isLanguage(next)) return;
  cookies().set({
    name: LOCALE_COOKIE,
    value: next,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}
