"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import LanguageToggle from "@/components/LanguageToggle";
import { getDirtyState } from "@/lib/admin/dirty-store";
import { createClient } from "@/lib/supabase/client";
import type { Language } from "@/types/database";

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

type GuardState = {
  href: string;
  count: number;
  save: () => Promise<void>;
};

export default function AdminSidebar({ locale }: { locale: Language }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  // 모바일 햄버거 슬라이드 — 데스크탑에서는 CSS 가 .is-open 무시.
  const [mobileOpen, setMobileOpen] = useState(false);

  // dirty 상태 + 떠나려는 href 를 모달용으로 보관. 모달 표시 중일 때만 not-null.
  const [guard, setGuard] = useState<GuardState | null>(null);
  const [guardBusy, setGuardBusy] = useState(false);

  // SSR 단계에서는 document.body 가 없어 createPortal 호출 불가. client mount 후에만 true.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 모달 또는 모바일 사이드바 열려있을 때 body 스크롤 잠금.
  useEffect(() => {
    if (!guard && !mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [guard, mobileOpen]);

  // 경로가 바뀌면 (메뉴 클릭으로 이동했을 때 등) 모바일 사이드바 자동 닫기.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    if (loggingOut) return;
    // 로그아웃도 dirty 면 가드. 사용자가 로그아웃을 명시적으로 눌렀으니 confirm 만.
    const dirty = getDirtyState();
    if (dirty && dirty.count > 0) {
      const ok = window.confirm(
        `저장하지 않은 변경사항 ${dirty.count}개가 있어요. 로그아웃하시겠어요?`,
      );
      if (!ok) return;
    }
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function handleNavClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    // 같은 메뉴(현재 페이지) 면 가드 불필요. 모바일 사이드바만 닫는다.
    if (pathname.startsWith(href)) {
      setMobileOpen(false);
      return;
    }
    const dirty = getDirtyState();
    if (!dirty || dirty.count === 0) {
      // 모바일 사이드바는 pathname 변화 useEffect 가 자동으로 닫지만,
      // 클릭 즉시 닫혀 보이도록 명시.
      setMobileOpen(false);
      return;
    }
    // dirty — 기본 Link 이동을 막고 모달 띄움.
    e.preventDefault();
    setGuard({ href, count: dirty.count, save: dirty.save });
  }

  async function handleGuardSave() {
    if (!guard || guardBusy) return;
    setGuardBusy(true);
    try {
      await guard.save();
    } catch (err) {
      console.error("[admin/sidebar] guard save failed:", err);
      // 저장 실패 시 모달은 유지 — 사용자가 다시 시도하거나 "버리고 이동" 선택.
      setGuardBusy(false);
      return;
    }
    setGuardBusy(false);
    const href = guard.href;
    setGuard(null);
    router.push(href);
  }

  function handleGuardDiscard() {
    if (!guard) return;
    const href = guard.href;
    setGuard(null);
    router.push(href);
  }

  function handleGuardCancel() {
    if (guardBusy) return;
    setGuard(null);
  }

  return (
    <>
      {/* 모바일 한정 햄버거 버튼 — 데스크탑에서는 CSS 로 숨김. fixed top-left. */}
      <button
        type="button"
        className="admin-sidebar-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={mobileOpen}
      >
        <span aria-hidden="true">☰</span>
      </button>

      <aside
        className={`admin-sidebar${mobileOpen ? " is-open" : ""}`}
        aria-hidden={
          // 모바일에서 닫혀있을 때 screen reader 가 메뉴 탐색하지 않도록.
          // 데스크탑에서는 항상 visible 이지만 attribute 가 영향 없음 (CSS 분기).
          !mobileOpen ? undefined : false
        }
      >
        <div className="admin-sidebar-title">
          <span>Admin</span>
          <LanguageToggle current={locale} />
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => {
            // startsWith 로 sub-route(/admin/dashboard/commissions/123 등)도 부모 메뉴를 활성화.
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-item${active ? " admin-nav-item-active" : ""}`}
                onClick={(e) => handleNavClick(e, item.href)}
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

      {/* 모바일 사이드바 오버레이 — 클릭 시 닫기. 데스크탑은 CSS 로 숨김. */}
      {mobileOpen && (
        <div
          className="admin-sidebar-overlay"
          role="presentation"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* navigation guard 모달을 document.body 로 포탈. RichTextEditor 내부의
          ProseMirror 가 자체 stacking context 를 만들어 부모(.admin-sidebar 또는
          .admin-main-card) 내부에서 모달을 띄우면 그 안의 텍스트가 모달 위로
          비치는 문제가 있어 body 끝으로 escape — z-index 위계 외에 stacking
          context 의 상위 도달성도 함께 확보. */}
      {mounted && guard
        ? createPortal(
            <div
              className="admin-nav-guard-overlay"
              role="presentation"
              onClick={handleGuardCancel}
            >
              <div
                className="admin-nav-guard-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-nav-guard-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="admin-nav-guard-title"
                  className="admin-nav-guard-title"
                >
                  저장하지 않은 변경사항이 있어요
                </h2>
                <p className="admin-nav-guard-text">
                  이 페이지에 저장하지 않은 변경사항 {guard.count}개가 있어요. 어떻게 할까요?
                </p>
                <div className="admin-nav-guard-actions">
                  <button
                    type="button"
                    className="admin-nav-guard-btn"
                    onClick={handleGuardCancel}
                    disabled={guardBusy}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="admin-nav-guard-btn admin-nav-guard-btn-danger"
                    onClick={handleGuardDiscard}
                    disabled={guardBusy}
                  >
                    버리고 이동
                  </button>
                  <button
                    type="button"
                    className="admin-nav-guard-btn admin-nav-guard-btn-primary"
                    onClick={handleGuardSave}
                    disabled={guardBusy}
                  >
                    {guardBusy ? "저장 중..." : "저장 후 이동"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
