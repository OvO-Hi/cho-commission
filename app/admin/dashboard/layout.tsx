import { redirect } from "next/navigation";

import AdminSidebar from "@/components/AdminSidebar";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">{children}</main>
    </div>
  );
}
