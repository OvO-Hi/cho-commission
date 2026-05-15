"use client";

import { useEffect } from "react";

import SamplePageRenderer, {
  type SampleBlockWithImages,
} from "@/components/SamplePageRenderer";
import type { CommissionCategory } from "@/types/database";

const CATEGORY_LABEL: Record<CommissionCategory, string> = {
  live2d: "Live2D",
  illust: "Illust",
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  blocks: SampleBlockWithImages[];
  category: CommissionCategory;
};

export default function SamplesPreviewModal({
  isOpen,
  onClose,
  blocks,
  category,
}: Props) {
  // 모달 열려 있을 때 body scroll 잠금 + ESC 닫기 (다른 어드민 모달과 동일 패턴).
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="admin-detail-modal admin-samples-preview-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-samples-preview-title"
      >
        <header className="admin-detail-header">
          <h2 id="admin-samples-preview-title" className="admin-detail-title">
            샘플 페이지 미리보기 — {CATEGORY_LABEL[category]}
          </h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="admin-detail-body admin-samples-preview-body">
          <SamplePageRenderer blocks={blocks} />
        </div>

        <footer className="admin-detail-footer">
          <button
            type="button"
            className="admin-action-btn"
            onClick={onClose}
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
