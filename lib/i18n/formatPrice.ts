// locale 별 가격 포맷. 통화 기호는 직접 prefix — Intl.NumberFormat 의 currency
// 옵션은 locale 에 따라 기호 위치/공백/별칭(JPY 가 ¥ 가 아닌 'JP¥' 로 나오는 등)
// 이 달라져서 사이트 표기 일관성을 깨므로 천단위 구분만 Intl 에 위임.
//
// 호출 측 주의: row 가 fallback 데이터 (예: locale=en 이지만 KO row) 라면
// **row 의 language 필드** 를 그대로 넘겨야 통화 단위와 숫자 (KRW 100000 vs USD 25)
// 가 어긋나지 않음. 페이지 locale 이 아니라 데이터 locale 기준이라는 뜻.

import type { Language } from "@/types/database";

const CURRENCY_SYMBOL: Record<Language, string> = {
  ko: "₩",
  en: "$",
  jp: "¥",
};

const NUMBER_LOCALE: Record<Language, string> = {
  ko: "ko-KR",
  en: "en-US",
  jp: "ja-JP",
};

export function formatPrice(
  price: number,
  locale: Language,
  options?: { isAddon?: boolean; isApprox?: boolean },
): string {
  const number = new Intl.NumberFormat(NUMBER_LOCALE[locale]).format(price);
  const symbol = CURRENCY_SYMBOL[locale];
  const prefix = options?.isAddon ? "+" : "";
  const suffix = options?.isApprox ? "~" : "";
  return `${prefix}${symbol}${number}${suffix}`;
}
