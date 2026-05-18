"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import BackToTopButton from "@/components/BackToTopButton";
import {
  ILLUST_IMAGES_KEY,
  ILLUST_SUBMISSION_KEY,
} from "@/components/IllustCommissionForm";
import { getFormMessages } from "@/lib/i18n/form-messages";
import { readLocaleCookie } from "@/lib/i18n/locale-client";
import {
  formatAttachmentAlt,
  getPageMessages,
} from "@/lib/i18n/page-messages";
import type { ApplicationType, Language } from "@/types/database";

type Submitted = {
  type: "illust";
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

export default function IllustCompletePage() {
  const router = useRouter();
  const [data, setData] = useState<Submitted | null>(null);
  const [images, setImages] = useState<string[]>([]);
  // locale 은 SSR 시점에 document 가 없어 'ko' 로 초기화 후 mount 직후 쿠키에서 갱신.
  // (render 안에서 readLocaleCookie 를 직접 호출하면 SSR 결과와 hydration 결과가
  // 갈려 React 경고가 뜸.)
  const [locale, setLocale] = useState<Language>("ko");

  useEffect(() => {
    setLocale(readLocaleCookie());

    const raw = sessionStorage.getItem(ILLUST_SUBMISSION_KEY);
    if (!raw) {
      router.replace("/illust");
      return;
    }
    try {
      setData(JSON.parse(raw) as Submitted);
    } catch {
      router.replace("/illust");
      return;
    }

    const rawImages = sessionStorage.getItem(ILLUST_IMAGES_KEY);
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

  const formMsg = getFormMessages(locale);
  const pageMsg = getPageMessages(locale);

  // Illust 폼에서 사용하는 5가지 옵션만 매핑. Live2D 옵션(illust/both) 은 여기서 표시될 일이 없습니다.
  const applicationLabel: Partial<Record<ApplicationType, string>> = {
    broadcast_bust: formMsg.broadcast_bust,
    broadcast_half: formMsg.broadcast_half,
    broadcast_full: formMsg.broadcast_full,
    commercial_with_bg: formMsg.commercial_with_bg,
    commercial_no_bg: formMsg.commercial_without_bg,
  };

  return (
    <main className="l2d-shell">
      <BackToTopButton locale={locale} />
      <div className="l2d-container">
        <div className="l2d-topbar">
          <Link
            href="/"
            className="l2d-back"
            aria-label={pageMsg.back_to_main_aria}
          >
            {pageMsg.back_to_main}
          </Link>
        </div>

        <header className="l2d-complete-hero">
          <div className="l2d-complete-check" aria-hidden>
            ✓
          </div>
          <h1 className="l2d-complete-title">
            {pageMsg.submission_complete_title}
          </h1>
          <p className="l2d-complete-sub">{pageMsg.submission_complete_sub}</p>
        </header>

        <div className="l2d-card l2d-summary-card">
          <h2 className="l2d-summary-title">{pageMsg.submission_title}</h2>
          <dl className="l2d-summary">
            <SummaryRow label={formMsg.nickname} value={data.nickname} />
            <SummaryRow label={formMsg.contact} value={data.contact} />
            <SummaryRow
              label={formMsg.desired_date}
              value={data.desired_date || "—"}
            />
            <SummaryRow
              label={formMsg.work_process_private}
              value={
                data.process_private
                  ? formMsg.private_label
                  : formMsg.no_preference
              }
            />
            <SummaryRow
              label={formMsg.portfolio_private}
              value={
                data.portfolio_private
                  ? formMsg.private_label
                  : formMsg.no_preference
              }
            />
            <SummaryRow
              label={formMsg.request_type}
              value={applicationLabel[data.application_type] ?? "—"}
            />
            <SummaryRow
              label={formMsg.request_character}
              value={data.character_description}
              block
            />
            {images.length > 0 && (
              <div className="l2d-summary-row l2d-summary-row-block">
                <dt>{pageMsg.attached_images_label}</dt>
                <dd>
                  <div className="l2d-summary-images">
                    {images.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={formatAttachmentAlt(locale, i + 1)}
                        className="l2d-summary-image"
                      />
                    ))}
                  </div>
                </dd>
              </div>
            )}
            <SummaryRow
              label={formMsg.additional_notes}
              value={data.additional_notes || "—"}
              block
            />
          </dl>
        </div>

        <div className="l2d-complete-actions">
          <Link href="/illust" className="l2d-back-btn">
            {pageMsg.back_to_apply_aria}
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
