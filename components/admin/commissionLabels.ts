import type { ApplicationType, CommissionCategory } from "@/types/database";

// 두 카테고리(Live2D / Illust) 의 신청 타입 라벨을 한 곳에서 관리.
// CommissionsList / CommissionDetailModal / PDF 출력에서 모두 같은 텍스트 사용.
export const APPLICATION_LABELS: Partial<Record<ApplicationType, string>> = {
  illust: "일러스트만",
  both: "일러스트 + 리깅",
  broadcast_bust: "방송용 - 흉상",
  broadcast_half: "방송용 - 반신",
  broadcast_full: "방송용 - 전신",
  commercial_with_bg: "상업용 - 배경포함",
  commercial_no_bg: "상업용 - 미포함",
};

export const TYPE_LABELS: Record<CommissionCategory, string> = {
  live2d: "Live2D",
  illust: "Illust",
};

// "2026-05-01 14:30" 형식. Asia/Seoul 고정 — d.getHours() 같은 로컬 TZ API 를
// 쓰면 서버(UTC)와 클라이언트(KST)가 다른 문자열을 만들어 hydration mismatch
// (React #418/#423) 가 발생하므로 Intl.DateTimeFormat 으로 명시 timezone 적용.
export function formatCommissionDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
