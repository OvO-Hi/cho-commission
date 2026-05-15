"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AdminLoginModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ESC 키로 닫기.
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // 모달 열려 있을 때 배경 스크롤 잠금.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // 모달 닫힐 때 입력값/에러 리셋.
  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setPassword("");
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다");
      setSubmitting(false);
      return;
    }

    // 라우트 push 후 server component 가 새 쿠키 기반으로 다시 렌더되도록 refresh().
    router.push("/admin/dashboard");
    router.refresh();
  }

  if (!isOpen) return null;

  return (
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="admin-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
      >
        <button
          type="button"
          className="admin-modal-close"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>

        <h2 id="admin-modal-title" className="admin-modal-title">
          관리자 로그인
        </h2>

        <form className="admin-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-form-field">
            <label htmlFor="admin-email" className="admin-form-label">
              이메일
            </label>
            <input
              id="admin-email"
              type="email"
              className="admin-form-input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="admin-password" className="admin-form-label">
              비밀번호
            </label>
            <input
              id="admin-password"
              type="password"
              className="admin-form-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="admin-form-error">{error}</p>}

          <button
            type="submit"
            className="admin-form-submit"
            disabled={submitting || !email || !password}
          >
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
