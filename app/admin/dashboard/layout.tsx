import { redirect } from "next/navigation";

import AdminSidebar from "@/components/AdminSidebar";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

// LanguageToggle 로 locale cookie 가 바뀐 직후 router.refresh 가 layout RSC 캐시
// 를 invalidate 하지 못해 stale locale 이 사이드바/매니저 prop 으로 흘러간 버그가
// 있었다. layout 단에서 직접 cookies() 를 읽어 prop 으로 내려보내므로 항상 동적이어야
// 한다 — 명시적으로 force-dynamic.
export const dynamic = "force-dynamic";

// 미들웨어가 1차로 /admin/* 인증을 차단하지만,
// 레이아웃에서도 한 번 더 확인해 defense-in-depth 를 둡니다.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // 어드민 다국어: 토글 + 어드민 페이지들이 현재 locale 로 fetch 하도록.
  const locale = await getCurrentLocale();

  return (
    <div className="admin-shell">
      <AdminSidebar locale={locale} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
