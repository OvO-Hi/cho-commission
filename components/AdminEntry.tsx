"use client";

import { useState } from "react";

import AdminLoginModal from "./AdminLoginModal";

// 메인 페이지 우측 하단의 작은 어드민 진입 텍스트.
// 일반 방문자에게는 거의 보이지 않을 정도로 톤다운 → 클릭 시 로그인 모달 오픈.
export default function AdminEntry() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="admin-entry-btn"
        onClick={() => setOpen(true)}
        aria-label="관리자 로그인"
      >
        Admin
      </button>
      <AdminLoginModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
