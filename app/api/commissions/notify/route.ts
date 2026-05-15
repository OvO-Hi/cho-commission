import { NextRequest, NextResponse } from "next/server";

import { sendCommissionNotification } from "@/lib/email/send-commission-notification";
import type { Commission } from "@/types/database";

// Resend SDK 가 Node 환경에서 가장 안정적이라 명시.
export const runtime = "nodejs";

// 신청 폼이 INSERT 직후 호출하는 알림 트리거.
// 이메일 발송이 실패해도 신청 자체에는 영향이 없도록 항상 200 OK 를 반환합니다 — 폼은 fire-and-forget.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    console.error("[notify-api] JSON parse failed:", err);
    return NextResponse.json({ ok: false, reason: "invalid-json" });
  }

  if (!isCommissionLike(body)) {
    console.warn("[notify-api] payload validation failed. body=", body);
    return NextResponse.json({ ok: false, reason: "invalid-payload" });
  }

  try {
    await sendCommissionNotification(body);
  } catch (err) {
    // sendCommissionNotification 은 내부에서 swallow 하므로 여기 도달하면 의외의 throw.
    console.error("[notify-api] unexpected throw:", err);
  }

  return NextResponse.json({ ok: true });
}

function isCommissionLike(value: unknown): value is Commission {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.nickname === "string" &&
    typeof v.character_description === "string" &&
    (v.type === "live2d" || v.type === "illust")
  );
}
