// Client-side locale 읽기. server-only 인 lib/i18n/locale.ts 의 client 짝.
//
// next/headers cookies() 는 서버 전용이라 client component 에서 직접 못 씀.
// 같은 'locale' 쿠키를 document.cookie 로 읽어 동일한 fallback 정책 적용.
// SSR / 첫 mount 등 document 가 없는 시점에는 ko 반환 — 이후 effect 안에서 다시 호출.

import type { Language } from "@/types/database";

const LOCALE_COOKIE = "locale";

export function readLocaleCookie(): Language {
  if (typeof document === "undefined") return "ko";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  const v = match?.[1];
  if (v === "en" || v === "jp" || v === "ko") return v;
  return "ko";
}
