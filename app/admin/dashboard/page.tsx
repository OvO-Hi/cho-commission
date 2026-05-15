import { redirect } from "next/navigation";

// 대시보드 root 진입은 첫 번째 메뉴(커미션 관리)로 자동 이동.
export default function AdminDashboardRoot() {
  redirect("/admin/dashboard/commissions");
}
