import Link from "next/link";

import BackToTopButton from "@/components/BackToTopButton";
import ScrollProgress from "@/components/ScrollProgress";
import { sanitizeRich } from "@/lib/utils/sanitize";
import { createClient } from "@/lib/supabase/server";
import type { CopyrightRule, NoticeSection } from "@/types/database";

export const dynamic = "force-dynamic";

const RICH_SECTIONS: { key: NoticeSection; title: string }[] = [
  { key: "intro", title: "자기소개" },
  { key: "notice", title: "공지사항" },
  { key: "guide", title: "저작권 범위" },
  { key: "refund", title: "환불 안내" },
];

const COPYRIGHT_HEADERS: {
  key: keyof Pick<
    CopyrightRule,
    "allow_personal" | "allow_sns" | "allow_broadcast" | "allow_youtube" | "allow_goods"
  >;
  label: string;
}[] = [
  { key: "allow_personal", label: "개인소장" },
  { key: "allow_sns", label: "SNS 업로드" },
  { key: "allow_broadcast", label: "방송 사용" },
  { key: "allow_youtube", label: "유튜브" },
  { key: "allow_goods", label: "굿즈 및 판매" },
];

// sanitize 옵션은 lib/utils/sanitize 의 공용 RICH_SANITIZE_OPTIONS 재사용.

export default async function NoticePage() {
  const supabase = createClient();

  const [noticesRes, rulesRes] = await Promise.all([
    supabase
      .from("notices")
      .select("*")
      .eq("category", "common")
      .eq("language", "ko")
      .order("order_num", { ascending: true }),
    supabase
      .from("copyright_rules")
      .select("*")
      .order("order_num", { ascending: true }),
  ]);

  if (noticesRes.error) {
    console.error("[notice] failed to fetch notices:", noticesRes.error.message);
  }
  if (rulesRes.error) {
    console.error("[notice] failed to fetch rules:", rulesRes.error.message);
  }

  // 1섹션 = 1행 정책. 같은 섹션의 첫 번째 row 만 사용.
  const sectionMap = new Map<string, string>();
  for (const n of noticesRes.data ?? []) {
    if (!sectionMap.has(n.section)) sectionMap.set(n.section, n.content);
  }

  const rules = rulesRes.data ?? [];

  return (
    <main className="notice-shell">
      <ScrollProgress />
      <BackToTopButton />
      <div className="notice-container">
        <div className="notice-topbar">
          <Link href="/" className="notice-back" aria-label="메인으로 돌아가기">
            ← 메인으로
          </Link>
        </div>

        <header className="notice-hero">
          <h1 className="notice-hero-title">Notice</h1>
          <p className="notice-hero-sub">
            커미션 신청 전 꼭 확인해 주세요.
          </p>
        </header>

        {RICH_SECTIONS.map(({ key, title }) => {
          const isGuide = key === "guide";
          const html = sectionMap.get(key) ?? "";

          return (
            <section key={key} className="notice-section">
              <h2 className="notice-section-title">{title}</h2>
              <div className="notice-card">
                {isGuide ? (
                  <CopyrightTable rules={rules} />
                ) : html.trim() ? (
                  <div
                    className="notice-rich"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRich(html),
                    }}
                  />
                ) : (
                  <p className="notice-empty">준비 중입니다.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function CopyrightTable({ rules }: { rules: CopyrightRule[] }) {
  if (rules.length === 0) {
    return <p className="notice-empty">준비 중입니다.</p>;
  }
  return (
    <div className="notice-table-wrap">
      <table className="notice-table">
        <thead>
          <tr>
            <th aria-hidden />
            {COPYRIGHT_HEADERS.map((h) => (
              <th key={h.key}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <th scope="row">{rule.label}</th>
              {COPYRIGHT_HEADERS.map((h) => {
                const allowed = Boolean(rule[h.key]);
                return (
                  <td key={h.key}>
                    {allowed ? (
                      <span
                        className="notice-mark notice-mark-o"
                        aria-label="허용"
                      >
                        O
                      </span>
                    ) : (
                      <span
                        className="notice-mark notice-mark-x"
                        aria-label="불가"
                      >
                        X
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
