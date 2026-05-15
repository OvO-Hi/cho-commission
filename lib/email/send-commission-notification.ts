import { Resend } from "resend";

import {
  APPLICATION_LABELS,
  TYPE_LABELS,
  formatCommissionDate,
} from "@/components/admin/commissionLabels";
import type { Commission } from "@/types/database";

// 서버 사이드 전용 이메일 발송 함수.
// 실패해도 신청 자체는 정상 처리되도록 throw 하지 않고 콘솔에만 남깁니다.
export async function sendCommissionNotification(
  commission: Commission,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;

  if (!apiKey || !to) {
    console.error(
      "[email] 환경변수가 설정되지 않아 이메일 발송을 건너뜁니다 — RESEND_API_KEY:",
      apiKey ? "OK" : "MISSING",
      "ADMIN_NOTIFICATION_EMAIL:",
      to ? "OK" : "MISSING",
    );
    return;
  }

  const resend = new Resend(apiKey);
  const subject = `[Cho Commission] 새 신청이 도착했어요 - ${commission.nickname}`;
  const html = buildHtml(commission);
  const from = "Cho Commission <onboarding@resend.dev>";

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });
    if (result.error) {
      console.error("[email] resend returned error:", result.error);
    }
  } catch (err) {
    console.error("[email] resend exception:", err);
    if (err instanceof Error) {
      console.error("[email] error name=", err.name, "message=", err.message);
    }
  }
}

// HTML 이메일 본문 생성. 사용자 입력은 모두 escapeHtml 통과시켜 인젝션 방지.
function buildHtml(commission: Commission): string {
  const dateStr = formatCommissionDate(commission.created_at);
  const typeLabel = TYPE_LABELS[commission.type];
  const appLabel = APPLICATION_LABELS[commission.application_type] ?? "—";
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const adminUrl = `${baseUrl}/admin/dashboard/commissions`;
  const imageUrls = commission.image_urls ?? [];
  const imageCount = imageUrls.length;
  const PREVIEW_MAX = 4;
  const previewUrls = imageUrls.slice(0, PREVIEW_MAX);
  const remainingCount = imageCount - previewUrls.length;

  const sectionTitleStyle = `margin: 28px 0 10px; font-size: 12px; color: #777; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #eee; padding-bottom: 6px; font-weight: 600;`;
  const labelCellStyle = `color: #888; padding: 5px 0; width: 130px; vertical-align: top;`;
  const valueCellStyle = `padding: 5px 0; vertical-align: top;`;
  const textBlockStyle = `margin: 0; font-size: 14px; line-height: 1.7; white-space: pre-line; word-break: break-word; color: #1a1a1a;`;

  return `
<div style="background: #f9fafb; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width: 560px; width: 100%; margin: 0 auto;">
    <tr>
      <td style="background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
        <h1 style="margin: 0 0 6px; font-size: 22px; color: #9EE17A; font-weight: 700;">새 커미션 신청이 도착했어요!</h1>
        <p style="margin: 0; font-size: 13px; color: #888;">${escapeHtml(commission.nickname)} · ${escapeHtml(dateStr)} · ${escapeHtml(typeLabel)}</p>

        <h2 style="${sectionTitleStyle}">신청자 정보</h2>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 14px; line-height: 1.6;">
          <tr><td style="${labelCellStyle}">닉네임</td><td style="${valueCellStyle}">${escapeHtml(commission.nickname)}</td></tr>
          <tr><td style="${labelCellStyle}">연락처</td><td style="${valueCellStyle}">${escapeHtml(commission.contact ?? "—")}</td></tr>
          <tr><td style="${labelCellStyle}">받은 시간</td><td style="${valueCellStyle}">${escapeHtml(dateStr)}</td></tr>
        </table>

        <h2 style="${sectionTitleStyle}">신청 내용</h2>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 14px; line-height: 1.6;">
          <tr><td style="${labelCellStyle}">타입</td><td style="${valueCellStyle}">${escapeHtml(typeLabel)}</td></tr>
          <tr><td style="${labelCellStyle}">신청 타입</td><td style="${valueCellStyle}">${escapeHtml(appLabel)}</td></tr>
          <tr><td style="${labelCellStyle}">수령 희망 날짜</td><td style="${valueCellStyle}">${escapeHtml(commission.desired_date ?? "—")}</td></tr>
          <tr><td style="${labelCellStyle}">작업과정 비공개</td><td style="${valueCellStyle}">${commission.process_private ? "비공개" : "상관없음"}</td></tr>
          <tr><td style="${labelCellStyle}">포트폴리오 비공개</td><td style="${valueCellStyle}">${commission.portfolio_private ? "비공개" : "상관없음"}</td></tr>
        </table>

        <h2 style="${sectionTitleStyle}">신청 캐릭터</h2>
        <p style="${textBlockStyle}">${escapeHtml(commission.character_description)}</p>

        <h2 style="${sectionTitleStyle}">추가사항</h2>
        <p style="${textBlockStyle}">${escapeHtml(commission.additional_notes || "—")}</p>

        ${
          imageCount > 0
            ? `
        <h2 style="${sectionTitleStyle}">첨부 이미지 (${imageCount}개)</h2>
        <table role="presentation" cellpadding="0" cellspacing="6" border="0" style="margin-top: 4px;">
          <tr>
            ${previewUrls
              .map(
                (url) => `
            <td style="padding: 0;">
              <a href="${escapeHtml(url)}" style="text-decoration: none;">
                <img src="${escapeHtml(url)}" alt="첨부 이미지" width="120" height="120" style="display: block; width: 120px; height: 120px; object-fit: cover; border-radius: 8px; background: #f0f0f0; border: 1px solid #eee;" />
              </a>
            </td>`,
              )
              .join("")}
          </tr>
        </table>
        ${
          remainingCount > 0
            ? `<p style="margin: 8px 0 0; font-size: 12px; color: #888;">… 외 ${remainingCount}장 (어드민 페이지에서 전체 확인)</p>`
            : ""
        }
        `
            : ""
        }

        <div style="margin-top: 36px; text-align: center;">
          <a href="${escapeHtml(adminUrl)}" style="display: inline-block; padding: 14px 32px; background: #9EE17A; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px;">
            어드민 페이지에서 확인하기
          </a>
        </div>
      </td>
    </tr>
  </table>
</div>
  `.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
