// 다국어 데이터 fetch fallback 헬퍼.
//
// 정책 (사용자 명세 그대로): 선택한 locale 로 fetch → 결과가 비면 ko 로 재fetch.
// partial merge (일부 row 만 누락된 경우 그 row 만 ko 로 보충) 는 의도적으로 안 함.
//
// 시그니처 설계 이력
//   초안에서 supabase-js 의 PostgrestResponse / PostgrestMaybeSingleResponse 를
//   buildQuery 의 반환 타입으로 두려고 했으나, supabase builder 의 PromiseLike 가
//   success/failure union 이라 generic T 가 'never' 로 좁혀지는 추론 실패가 났다.
//   해결: buildQuery 가 await 된 결과(이미 unwrap 된 row 또는 row[])만 반환하도록 함.
//   호출부는 supabase 응답에서 .data 만 꺼내 반환하므로 추론이 안정적이다.

import type { Language } from "@/types/database";

// list 쿼리용. buildQuery 는 await 후 row 배열을 반환 (error/null 은 빈 배열로).
export async function fetchListWithFallback<T>(
  buildQuery: (locale: Language) => Promise<T[]>,
  locale: Language,
): Promise<T[]> {
  if (locale === "ko") return buildQuery("ko");
  const primary = await buildQuery(locale);
  if (primary.length > 0) return primary;
  return buildQuery("ko");
}

// single-row 쿼리용. buildQuery 는 row 또는 null 을 반환.
export async function fetchSingleWithFallback<T>(
  buildQuery: (locale: Language) => Promise<T | null>,
  locale: Language,
): Promise<T | null> {
  if (locale === "ko") return buildQuery("ko");
  const primary = await buildQuery(locale);
  if (primary) return primary;
  return buildQuery("ko");
}
