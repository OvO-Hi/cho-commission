// POST /api/translate
//
// 어드민 다국어 입력 인프라용. KO 원문을 Claude 로 EN/JP 번역.
// 다음 commit 에서 NoticesManager 등의 KO 저장 핸들러가 이 라우트를 호출.
//
// 보안
//   - 어드민(supabase auth) 만 호출 가능. anon 키 남용 방지.
//   - ANTHROPIC_API_KEY 누락 시 500 으로 명시.
//
// 응답 형식 안정성
//   - structured outputs (output_config.format = json_schema) 로 JSON 모양 강제.
//   - targets 배열에 따라 schema 의 required 필드를 동적으로 구성.
//   - JSON.parse 실패 케이스를 거의 없앰. 그래도 try/catch 로 방어.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";

type TargetLocale = "en" | "jp";

type RequestBody = {
  text: string;
  targetLocales: TargetLocale[];
  context?: string;
};

const ALLOWED_TARGETS: readonly TargetLocale[] = ["en", "jp"] as const;

// Haiku 4.5 — 저렴/빠름. 번역은 단순 추론이라 thinking/effort 불필요.
// Haiku 4.5 는 thinking 비지원, effort 비지원.
const MODEL_ID = "claude-haiku-4-5";

const SYSTEM_PROMPT =
  "당신은 한국어를 영어/일본어로 번역하는 전문가입니다. " +
  "주어진 한국어 텍스트를 자연스러운 영어/일본어로 번역하세요. " +
  "번역 결과만 출력하고 부가 설명은 하지 마세요. " +
  "HTML 태그가 있으면 그대로 유지하세요.";

function isTargetLocale(v: unknown): v is TargetLocale {
  return typeof v === "string" && (ALLOWED_TARGETS as readonly string[]).includes(v);
}

function validateBody(raw: unknown): RequestBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.text !== "string" || obj.text.length === 0) return null;
  if (!Array.isArray(obj.targetLocales) || obj.targetLocales.length === 0) return null;
  if (!obj.targetLocales.every(isTargetLocale)) return null;
  // dedupe
  const targets = Array.from(new Set(obj.targetLocales)) as TargetLocale[];
  const context = typeof obj.context === "string" ? obj.context : undefined;
  return { text: obj.text, targetLocales: targets, context };
}

// targets 에 따라 JSON schema 동적 구성 — 모델이 필요한 키만 반환하도록 강제.
function buildOutputSchema(targets: TargetLocale[]) {
  const properties: Record<string, { type: "string" }> = {};
  for (const t of targets) properties[t] = { type: "string" };
  return {
    type: "object" as const,
    properties,
    required: targets,
    additionalProperties: false,
  };
}

function buildUserMessage(text: string, targets: TargetLocale[], context?: string): string {
  const localeNames: Record<TargetLocale, string> = {
    en: "영어 (English)",
    jp: "일본어 (日本語)",
  };
  const targetList = targets.map((t) => localeNames[t]).join(", ");
  const contextLine = context ? `컨텍스트: ${context}\n\n` : "";
  return `${contextLine}다음 한국어 텍스트를 ${targetList} 로 번역하세요. 각 언어별 번역 결과를 JSON 으로 반환하세요.\n\n원문:\n${text}`;
}

export async function POST(req: Request) {
  // 1) 어드민 인증 — 미인증이면 키 사용 불가.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2) body 파싱 + validation
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const body = validateBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: "invalid body — { text: string, targetLocales: ('en'|'jp')[], context?: string }" },
      { status: 400 },
    );
  }

  // 3) API key 체크
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[api/translate] ANTHROPIC_API_KEY missing");
    return NextResponse.json(
      { error: "translation service not configured" },
      { status: 500 },
    );
  }

  // 4) Anthropic 호출
  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: buildOutputSchema(body.targetLocales),
        },
      },
      messages: [
        {
          role: "user",
          content: buildUserMessage(body.text, body.targetLocales, body.context),
        },
      ],
    });
  } catch (e) {
    // SDK typed exceptions 로 분기 가능하지만 라우트 입장에선 502 로 통합.
    const msg = e instanceof Error ? e.message : "anthropic api error";
    console.error("[api/translate] anthropic call failed:", msg);
    return NextResponse.json(
      { error: "translation api failed" },
      { status: 502 },
    );
  }

  // 5) 응답 파싱 — structured outputs 라 거의 안전하지만 방어적으로.
  const block = response.content[0];
  if (!block || block.type !== "text") {
    console.error("[api/translate] unexpected response shape", response.content);
    return NextResponse.json(
      { error: "translation parse failed" },
      { status: 500 },
    );
  }
  let translations: Partial<Record<TargetLocale, string>>;
  try {
    translations = JSON.parse(block.text);
  } catch (e) {
    console.error("[api/translate] JSON parse failed:", block.text);
    return NextResponse.json(
      { error: "translation parse failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    translations,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
}
