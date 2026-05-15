"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  deleteImage,
  extractStoragePath,
  uploadImage,
} from "@/lib/storage/upload";
import type { Banner } from "@/types/database";

type Props = {
  initial: Banner | null;
};

export default function BannersManager({ initial }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<Banner | null>(initial);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    // 새 toast 가 들어오면 자연스럽게 갱신되도록 동일 메시지일 때만 정리.
    setTimeout(() => {
      setToast((current) => (current === msg ? null : current));
    }, 2500);
  }

  // 서버가 router.refresh() 후 보낸 새 initial 동기화.
  useEffect(() => setCurrent(initial), [initial]);

  // 모달 열려 있을 때 body scroll 잠금 + ESC 닫기.
  useEffect(() => {
    const anyModal = !!pendingFile || confirmingDelete;
    if (!anyModal) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (uploading || deleting) return;
      if (confirmingDelete) setConfirmingDelete(false);
      else if (pendingFile) cancelUpload();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [pendingFile, confirmingDelete, uploading, deleting]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 가능하도록 초기화
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다.");
      return;
    }
    setError(null);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  }

  function cancelUpload() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
  }

  async function confirmUpload() {
    if (!pendingFile || uploading) return;
    setUploading(true);
    setError(null);

    // 1) 새 파일 Storage 업로드
    const result = await uploadImage(pendingFile, "banners");
    if (!result) {
      setUploading(false);
      setError("업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    // 2) 새 row INSERT
    const supabase = createClient();
    const { data: newRow, error: insertErr } = await supabase
      .from("banners")
      .insert({ image_url: result.url, is_active: true })
      .select()
      .single();

    if (insertErr || !newRow) {
      console.error(
        "[admin/banners] insert failed:",
        insertErr?.message,
      );
      // INSERT 실패 시 업로드 파일 cleanup → orphan 방지
      await deleteImage("banners", result.path);
      setUploading(false);
      setError("데이터베이스 저장에 실패했어요.");
      return;
    }

    // 3) 기존 활성 배너 정리:
    //    - row 는 is_active=false 로 비활성화 (이력 보존)
    //    - Storage 파일은 삭제 (orphan 방지, 실패해도 흐름 진행)
    const { data: oldActive } = await supabase
      .from("banners")
      .select("id, image_url")
      .eq("is_active", true)
      .neq("id", newRow.id);

    if (oldActive && oldActive.length > 0) {
      const { error: deactivateErr } = await supabase
        .from("banners")
        .update({ is_active: false })
        .eq("is_active", true)
        .neq("id", newRow.id);
      if (deactivateErr) {
        console.warn(
          "[admin/banners] old row deactivate failed:",
          deactivateErr.message,
        );
      }
      for (const old of oldActive) {
        const path = extractStoragePath(old.image_url, "banners");
        if (path) await deleteImage("banners", path);
      }
    }

    setCurrent(newRow);
    cancelUpload();
    setUploading(false);
    showToast("배너가 변경되었어요");
    router.refresh();
  }

  async function confirmDeleteBanner() {
    if (!current || deleting) return;
    setDeleting(true);
    setError(null);

    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("banners")
      .delete()
      .eq("id", current.id);

    if (delErr) {
      console.error("[admin/banners] delete failed:", delErr.message);
      setError("삭제에 실패했어요.");
      setDeleting(false);
      return;
    }

    const path = extractStoragePath(current.image_url, "banners");
    if (path) await deleteImage("banners", path);

    setCurrent(null);
    setConfirmingDelete(false);
    setDeleting(false);
    showToast("배너가 삭제되었어요");
    router.refresh();
  }

  return (
    <div className="admin-main-card">
      <h1 className="admin-main-title">배너 관리</h1>
      <p className="admin-banners-sub">
        메인 페이지에 표시되는 배너 이미지를 관리할 수 있어요
      </p>

      <div className="admin-banners-guide">
        <p>
          <strong>권장 사이즈</strong> 2560 × 1280px (최소 1920 × 960px)
        </p>
        <p>
          <strong>비율</strong> 2:1 가로형
        </p>
      </div>

      <div className="admin-banner-preview">
        {current ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.image_url} alt="현재 배너" />
            <button
              type="button"
              className="admin-banner-delete"
              onClick={() => setConfirmingDelete(true)}
              disabled={uploading || deleting}
            >
              삭제
            </button>
          </>
        ) : (
          <span className="admin-banner-empty">현재 등록된 배너가 없어요</span>
        )}
      </div>

      <div className="admin-banner-actions">
        {/* 숨겨진 파일 input — 버튼 클릭으로 트리거 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        {/* 토스트 / 에러를 버튼 옆에 배치 (Settings 페이지와 동일 패턴). */}
        {error ? (
          <span className="admin-settings-toast admin-settings-toast-err">
            {error}
          </span>
        ) : toast ? (
          <span className="admin-settings-toast">{toast}</span>
        ) : null}
        <button
          type="button"
          className="admin-action-btn admin-action-btn-primary"
          onClick={openFilePicker}
          disabled={uploading || deleting}
        >
          + 새 배너 업로드
        </button>
      </div>

      {/* 업로드 미리보기 모달 */}
      {pendingFile && pendingPreview && (
        <div
          className="admin-modal-overlay"
          onClick={() => !uploading && cancelUpload()}
          role="presentation"
        >
          <div
            className="admin-detail-modal admin-banner-upload-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-banner-upload-title"
          >
            <header className="admin-detail-header">
              <h2
                id="admin-banner-upload-title"
                className="admin-detail-title"
              >
                새 배너 미리보기
              </h2>
              <button
                type="button"
                className="admin-modal-close"
                onClick={cancelUpload}
                disabled={uploading}
                aria-label="닫기"
              >
                ✕
              </button>
            </header>

            <div className="admin-detail-body">
              <p className="admin-banner-upload-msg">
                이 이미지로 배너를 변경할까요?
              </p>
              <div className="admin-banner-upload-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingPreview} alt="새 배너 미리보기" />
              </div>
            </div>

            <footer className="admin-detail-footer">
              <button
                type="button"
                className="admin-action-btn"
                onClick={cancelUpload}
                disabled={uploading}
              >
                취소
              </button>
              <button
                type="button"
                className="admin-action-btn admin-action-btn-primary"
                onClick={confirmUpload}
                disabled={uploading}
              >
                {uploading ? "변경 중..." : "변경"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmingDelete && (
        <div
          className="admin-confirm-overlay"
          onClick={() => !deleting && setConfirmingDelete(false)}
          role="presentation"
        >
          <div
            className="admin-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h3 className="admin-confirm-title">정말 배너를 삭제할까요?</h3>
            <p className="admin-confirm-msg">
              메인 페이지에 배너가 표시되지 않게 됩니다.
            </p>
            <div className="admin-confirm-actions">
              <button
                type="button"
                className="admin-action-btn"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                취소
              </button>
              <button
                type="button"
                className="admin-action-btn admin-action-btn-danger"
                onClick={confirmDeleteBanner}
                disabled={deleting}
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
