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

// "2026-05-01 14:30" 형식.
export function formatCommissionDate(iso: string): string {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${min}`;
}
