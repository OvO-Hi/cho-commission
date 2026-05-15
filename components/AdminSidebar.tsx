"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard/commissions", label: "커미션 신청 관리" },
  { href: "/admin/dashboard/slots", label: "슬롯 관리" },
  { href: "/admin/dashboard/notices", label: "공지 관리" },
  { href: "/admin/dashboard/pricing", label: "가격 관리" },
  { href: "/admin/dashboard/process", label: "작업 과정" },
  { href: "/admin/dashboard/banners", label: "배너 관리" },
  { href: "/admin/dashboard/samples", label: "샘플 페이지 관리" },
  { href: "/admin/dashboard/settings", label: "사이트 설정" },
];

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-title">Admin</div>

      <nav className="admin-nav">
        {NAV_ITEMS.map((item) => {
          // startsWith 로 sub-route(/admin/dashboard/commissions/123 등)도 부모 메뉴를 활성화.
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-item${active ? " admin-nav-item-active" : ""}`}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="admin-logout"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "로그아웃 중..." : "로그아웃"}
      </button>
    </aside>
  );
}
