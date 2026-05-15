"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import BackToTopButton from "@/components/BackToTopButton";
import {
  LIVE2D_IMAGES_KEY,
  LIVE2D_SUBMISSION_KEY,
} from "@/components/Live2DCommissionForm";
import type { ApplicationType } from "@/types/database";

type Submitted = {
  type: "live2d";
  nickname: string;
  contact: string;
  desired_date: string | null;
  process_private: boolean;
  portfolio_private: boolean;
  application_type: ApplicationType;
  character_description: string;
  additional_notes: string | null;
  is_read: boolean;
  submitted_at: string;
};

// ApplicationType union 에 Illust 옵션도 포함되어 있으므로 Partial 로 좁힙니다.
// Live2D 폼에서 들어올 수 있는 값은 illust / both 둘뿐.
const APPLICATION_LABEL: Partial<Record<ApplicationType, string>> = {
  illust: "일러스트만",
  both: "일러스트 + 리깅",
};

export default function Live2DCompletePage() {
  const router = useRouter();
  const [data, setData] = useState<Submitted | null>(null);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    // sessionStorage 는 클라이언트에서만 접근 가능하므로 effect 안에서 읽습니다.
    // 직접 URL 로 들어오는 등 데이터가 없는 경우 신청 페이지로 보냅니다.
    const raw = sessionStorage.getItem(LIVE2D_SUBMISSION_KEY);
    if (!raw) {
      router.replace("/live2d");
      return;
    }
    try {
      setData(JSON.parse(raw) as Submitted);
    } catch {
      router.replace("/live2d");
      return;
    }

    // 이미지는 별도 키. 저장 실패 / 첨부 없음 모두 빈 배열 처리.
    const rawImages = sessionStorage.getItem(LIVE2D_IMAGES_KEY);
    if (rawImages) {
      try {
        const parsed = JSON.parse(rawImages);
        if (Array.isArray(parsed)) setImages(parsed);
      } catch {
        /* 무시 */
      }
    }
  }, [router]);

  if (!data) return null;

  return (
    <main className="l2d-shell">
      <BackToTopButton />
      <div className="l2d-container">
        <div className="l2d-topbar">
          <Link href="/" className="l2d-back" aria-label="메인으로 돌아가기">
            ← 메인으로
          </Link>
        </div>

        <header className="l2d-complete-hero">
          <div className="l2d-complete-check" aria-hidden>
            ✓
          </div>
          <h1 className="l2d-complete-title">제출이 완료되었습니다</h1>
          <p className="l2d-complete-sub">
            빠른 시일 내에 적어주신 연락처로 답변드리겠습니다
          </p>
        </header>

        <div className="l2d-card l2d-summary-card">
          <h2 className="l2d-summary-title">신청 내역</h2>
          <dl className="l2d-summary">
            <SummaryRow label="닉네임" value={data.nickname} />
            <SummaryRow label="연락처" value={data.contact} />
            <SummaryRow
              label="수령 희망 날짜"
              value={data.desired_date || "—"}
            />
            <SummaryRow
              label="작업과정 비공개"
              value={data.process_private ? "비공개" : "상관없음"}
            />
            <SummaryRow
              label="포트폴리오 비공개"
              value={data.portfolio_private ? "비공개" : "상관없음"}
            />
            <SummaryRow
              label="신청 타입"
              value={APPLICATION_LABEL[data.application_type] ?? "—"}
            />
            <SummaryRow
              label="신청 캐릭터"
              value={data.character_description}
              block
            />
            {images.length > 0 && (
              <div className="l2d-summary-row l2d-summary-row-block">
                <dt>첨부 이미지</dt>
                <dd>
                  <div className="l2d-summary-images">
                    {images.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={`첨부 이미지 ${i + 1}`}
                        className="l2d-summary-image"
                      />
                    ))}
                  </div>
                </dd>
              </div>
            )}
            <SummaryRow
              label="추가사항"
              value={data.additional_notes || "—"}
              block
            />
          </dl>
        </div>

        <div className="l2d-complete-actions">
          <Link href="/live2d" className="l2d-back-btn">
            신청 페이지로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({
  label,
  value,
  block = false,
}: {
  label: string;
  value: string;
  block?: boolean;
}) {
  return (
    <div className={`l2d-summary-row${block ? " l2d-summary-row-block" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
