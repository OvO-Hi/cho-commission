"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Commission } from "@/types/database";

import {
  APPLICATION_LABELS,
  TYPE_LABELS,
  formatCommissionDate,
} from "./commissionLabels";

type Props = {
  commission: Commission;
  onClose: () => void;
  onUpdate: (updated: Commission) => void;
  onDelete: (id: string) => void;
};

export default function CommissionDetailModal({
  commission,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const [label, setLabel] = useState(commission.admin_label ?? "");
  const [deadline, setDeadline] = useState(commission.deadline ?? "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF 캡처 영역. 화면에는 보이지 않는 off-screen 컨테이너로,
  // 모달의 시각적 레이아웃과 분리해 PDF 출력에 최적화된 마크업을 별도로 둡니다.
  const pdfRef = useRef<HTMLDivElement>(null);

  // ESC 닫기 + body scroll 잠금 (AdminLoginModal 과 같은 패턴)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmingDelete) setConfirmingDelete(false);
        else onClose();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, confirmingDelete]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // 다른 commission 으로 갈아탈 때 입력 state 동기화.
  useEffect(() => {
    setLabel(commission.admin_label ?? "");
    setDeadline(commission.deadline ?? "");
  }, [commission.id, commission.admin_label, commission.deadline]);

  const labelDirty = label.trim() !== (commission.admin_label ?? "");
  const deadlineDirty = deadline.trim() !== (commission.deadline ?? "");
  const metaDirty = labelDirty || deadlineDirty;

  async function saveMeta() {
    if (!metaDirty || savingMeta) return;
    setSavingMeta(true);
    setError(null);
    const supabase = createClient();
    const newLabel = label.trim() || null;
    const newDeadline = deadline.trim() || null;
    const { error: e } = await supabase
      .from("commissions")
      .update({ admin_label: newLabel, deadline: newDeadline })
      .eq("id", commission.id);
    setSavingMeta(false);
    if (e) {
      setError("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    onUpdate({
      ...commission,
      admin_label: newLabel,
      deadline: newDeadline,
    });
  }

  async function toggleRead() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const next = !commission.is_read;
    const { error: e } = await supabase
      .from("commissions")
      .update({ is_read: next })
      .eq("id", commission.id);
    setBusy(false);
    if (e) {
      setError("처리에 실패했어요.");
      return;
    }
    onUpdate({ ...commission, is_read: next });
  }

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("commissions")
      .delete()
      .eq("id", commission.id);
    setBusy(false);
    if (e) {
      setError("삭제에 실패했어요.");
      return;
    }
    onDelete(commission.id);
  }

  async function downloadPdf() {
    if (!pdfRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      // 라이브러리는 무거우므로 동적 import.
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = html2canvasMod.default;

      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      // 한 PDF 페이지에 들어갈 캔버스 픽셀 높이.
      const sliceHeightPx = Math.floor(
        (usableHeight / usableWidth) * canvas.width,
      );

      // 캔버스를 페이지 높이만큼 잘라서 한 장씩 PDF 페이지에 추가.
      // offset 트릭(같은 이미지를 음수 y 로 여러 번 addImage) 대신 슬라이스 방식을 쓰면
      // 페이지 경계에서 콘텐츠가 잘리는 문제를 피할 수 있고 파일 크기도 안정적입니다.
      let yPx = 0;
      let pageIndex = 0;

      while (yPx < canvas.height) {
        const remainingPx = canvas.height - yPx;
        const sliceHeight = Math.min(sliceHeightPx, remainingPx);

        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceHeight;
        const ctx = slice.getContext("2d");
        if (ctx) {
          // 슬라이스 배경을 흰색으로 채워 마지막 페이지의 빈 공간이 검게 나오는 현상을 방지.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(
            canvas,
            0,
            yPx,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
          );
        }

        const sliceData = slice.toDataURL("image/jpeg", 0.95);
        const sliceHeightMm = (sliceHeight / canvas.width) * usableWidth;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(sliceData, "JPEG", margin, margin, usableWidth, sliceHeightMm);

        yPx += sliceHeight;
        pageIndex++;
      }

      // 첨부 이미지 — 본문 PDF 가 끝난 뒤 한 장씩 별도 페이지로 추가.
      // 페이지 너비/높이에 맞춰 비율을 유지한 채 가운데 정렬 → 잘림/늘어남 모두 방지.
      const imageUrls = commission.image_urls ?? [];
      for (const url of imageUrls) {
        try {
          const info = await fetchImageForPdf(url);
          pdf.addPage();

          const ratio = info.width / info.height;
          let drawWidth = usableWidth;
          let drawHeight = drawWidth / ratio;
          // 너비 기준 스케일이 페이지 높이를 넘으면 높이 기준으로 다시 스케일.
          if (drawHeight > usableHeight) {
            drawHeight = usableHeight;
            drawWidth = drawHeight * ratio;
          }
          const x = margin + (usableWidth - drawWidth) / 2;
          const y = margin + (usableHeight - drawHeight) / 2;
          pdf.addImage(info.dataUrl, "JPEG", x, y, drawWidth, drawHeight);
        } catch (imgErr) {
          // 한 장 실패해도 나머지는 계속 진행 — 사용자에겐 PDF 자체는 성공으로 노출.
          console.error("[admin/commission-pdf] image fetch failed:", url, imgErr);
        }
      }

      const safe = (commission.admin_label || commission.nickname).replace(
        /[\\/:*?"<>|]/g,
        "_",
      );
      const dateStr = new Date(commission.created_at)
        .toISOString()
        .slice(0, 10);
      pdf.save(`커미션신청_${safe}_${dateStr}.pdf`);
    } catch (err) {
      console.error("[admin/commission-pdf]", err);
      setError("PDF 생성에 실패했어요.");
    } finally {
      setExportingPdf(false);
    }
  }

  const headline = commission.admin_label || commission.nickname;

  return (
    <>
      <div
        className="admin-modal-overlay"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="admin-detail-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-detail-title"
        >
          <header className="admin-detail-header">
            <h2 id="admin-detail-title" className="admin-detail-title">
              {headline}
              <span className={`admin-type-badge admin-type-${commission.type}`}>
                {TYPE_LABELS[commission.type]}
              </span>
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

          <div className="admin-detail-body">
            {/* 어드민 메모: 라벨 + 마감일 한 줄 + 저장 버튼. 한 번에 두 필드 동시 저장. */}
            <div className="admin-detail-label-box">
              <label
                htmlFor="admin-detail-label"
                className="admin-detail-label-title"
              >
                이 커미션을 뭐라고 부를까요?
              </label>
              <p className="admin-detail-label-hint">
                어드민에서만 보이는 이름이에요
              </p>
              <div className="admin-detail-label-row">
                <input
                  id="admin-detail-label"
                  type="text"
                  className="admin-form-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={commission.nickname}
                />
                <input
                  type="text"
                  className="admin-form-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="마감일 (예: 5/13)"
                  aria-label="마감일"
                />
                <button
                  type="button"
                  className="admin-action-btn admin-action-btn-primary"
                  onClick={saveMeta}
                  disabled={!metaDirty || savingMeta}
                >
                  {savingMeta ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>

            <div className="admin-detail-display-area">
              <h3 className="admin-detail-section-title">신청 내용</h3>
              <dl className="admin-detail-grid">
                <Row label="닉네임" value={commission.nickname} />
                <Row label="연락처" value={commission.contact ?? "—"} />
                <Row
                  label="수령 희망 날짜"
                  value={commission.desired_date ?? "—"}
                />
                <Row
                  label="작업과정 비공개"
                  value={commission.process_private ? "비공개" : "상관없음"}
                />
                <Row
                  label="포트폴리오 비공개"
                  value={commission.portfolio_private ? "비공개" : "상관없음"}
                />
                <Row
                  label="신청 타입"
                  value={
                    APPLICATION_LABELS[commission.application_type] ?? "—"
                  }
                />
                <Row
                  label="받은 날짜"
                  value={formatCommissionDate(commission.created_at)}
                />
              </dl>

              <h3 className="admin-detail-section-title">신청 캐릭터</h3>
              <p className="admin-detail-text">
                {commission.character_description}
              </p>

              {commission.image_urls && commission.image_urls.length > 0 && (
                <>
                  <h3 className="admin-detail-section-title">첨부 이미지</h3>
                  <div className="admin-detail-images-grid">
                    {commission.image_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-detail-image-link"
                        aria-label={`첨부 이미지 ${i + 1} 새 탭에서 열기`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`첨부 ${i + 1}`} />
                      </a>
                    ))}
                  </div>
                </>
              )}

              <h3 className="admin-detail-section-title">추가사항</h3>
              <p className="admin-detail-text">
                {commission.additional_notes || "—"}
              </p>
            </div>

            {error && <p className="admin-form-error">{error}</p>}
          </div>

          <footer className="admin-detail-footer">
            <button
              type="button"
              className="admin-action-btn admin-action-btn-danger"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              삭제
            </button>
            <button
              type="button"
              className="admin-action-btn"
              onClick={toggleRead}
              disabled={busy}
            >
              {commission.is_read ? "미읽음 처리" : "읽음 처리"}
            </button>
            <button
              type="button"
              className="admin-action-btn admin-action-btn-primary"
              onClick={downloadPdf}
              disabled={exportingPdf}
            >
              {exportingPdf ? "PDF 생성 중..." : "PDF 다운로드"}
            </button>
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

      {confirmingDelete && (
        <div
          className="admin-confirm-overlay"
          onClick={() => !busy && setConfirmingDelete(false)}
          role="presentation"
        >
          <div
            className="admin-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h3 className="admin-confirm-title">정말 삭제하시겠어요?</h3>
            <p className="admin-confirm-msg">이 작업은 되돌릴 수 없어요.</p>
            <div className="admin-confirm-actions">
              <button
                type="button"
                className="admin-action-btn"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="button"
                className="admin-action-btn admin-action-btn-danger"
                onClick={confirmDelete}
                disabled={busy}
              >
                {busy ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF 전용 off-screen 렌더 영역.
          display:none 이면 html2canvas 가 레이아웃을 못 잡으므로 좌측으로 멀리 보내 시각적으로만 숨깁니다.
          width 를 760px 로 고정해 PDF 출력이 화면 폭과 무관하게 일정하도록 합니다. */}
      <div ref={pdfRef} className="admin-pdf-source" aria-hidden>
        <h1 className="admin-pdf-title">
          {commission.admin_label || `${commission.nickname}님 커미션`}
        </h1>
        <p className="admin-pdf-meta">
          {commission.nickname} · {formatCommissionDate(commission.created_at)}{" "}
          · {TYPE_LABELS[commission.type]}
        </p>

        <h2 className="admin-pdf-section">어드민 메모</h2>
        <dl className="admin-pdf-grid">
          <PdfRow label="라벨" value={commission.admin_label || "—"} />
          <PdfRow label="마감일" value={commission.deadline || "—"} />
        </dl>

        <h2 className="admin-pdf-section">신청 내용</h2>
        <dl className="admin-pdf-grid">
          <PdfRow label="닉네임" value={commission.nickname} />
          <PdfRow label="연락처" value={commission.contact ?? "—"} />
          <PdfRow
            label="수령 희망 날짜"
            value={commission.desired_date ?? "—"}
          />
          <PdfRow
            label="작업과정 비공개"
            value={commission.process_private ? "비공개" : "상관없음"}
          />
          <PdfRow
            label="포트폴리오 비공개"
            value={commission.portfolio_private ? "비공개" : "상관없음"}
          />
          <PdfRow
            label="신청 타입"
            value={APPLICATION_LABELS[commission.application_type] ?? "—"}
          />
          <PdfRow
            label="받은 날짜"
            value={formatCommissionDate(commission.created_at)}
          />
        </dl>

        <h2 className="admin-pdf-section">신청 캐릭터</h2>
        <p className="admin-pdf-text">{commission.character_description}</p>

        {commission.image_urls && commission.image_urls.length > 0 && (
          <>
            <h2 className="admin-pdf-section">첨부 이미지</h2>
            <p className="admin-pdf-text">
              첨부 이미지 {commission.image_urls.length}개 — 이어지는 페이지에 한 장씩 표시됩니다.
            </p>
          </>
        )}

        <h2 className="admin-pdf-section">추가사항</h2>
        <p className="admin-pdf-text">{commission.additional_notes || "—"}</p>

        {/* 마지막 콘텐츠가 페이지 경계에서 잘리지 않도록 충분한 하단 여백 확보. */}
        <div className="admin-pdf-bottom-spacer" />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-detail-grid-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PdfRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-pdf-grid-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// 첨부 이미지 URL 을 PDF 에 넣을 수 있는 형태로 가져오기.
// CORS 캡처(crossOrigin='anonymous') + canvas 우회로 원본 포맷(WEBP 등) 에 무관하게
// JPEG dataURL 로 변환합니다. naturalWidth/Height 도 함께 반환해 jsPDF 비율 계산에 사용.
async function fetchImageForPdf(url: string): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = (e) => reject(e);
    i.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  // 흰 배경 → 투명 PNG 가 검정으로 바뀌는 것을 방지.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
}
