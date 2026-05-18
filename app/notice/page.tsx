import Link from "next/link";

import BackToTopButton from "@/components/BackToTopButton";
import LanguageToggle from "@/components/LanguageToggle";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";
import { sanitizeRich } from "@/lib/utils/sanitize";
import { createClient } from "@/lib/supabase/server";
import { fetchListWithFallback } from "@/lib/i18n/fetchWithFallback";
import { getCurrentLocale } from "@/lib/i18n/locale";
import type {
  CopyrightColumn,
  CopyrightRule,
  CopyrightRuleValue,
  Language,
  NoticeSection,
} from "@/types/database";

export const dynamic = "force-dynamic";

const RICH_SECTIONS: { key: NoticeSection; title: string }[] = [
  { key: "intro", title: "자기소개" },
  { key: "notice", title: "공지사항" },
  { key: "guide", title: "저작권 범위" },
  { key: "refund", title: "환불 안내" },
];

// 현재 노출 언어에서 열 라벨 추출. label_xx 가 NULL/빈문자열이면 label_ko 로 fallback.
function pickColumnLabel(column: CopyrightColumn, locale: Language): string {
  if (locale === "en") return column.label_en?.trim() || column.label_ko;
  if (locale === "jp") return column.label_jp?.trim() || column.label_ko;
  return column.label_ko;
}

export default async function NoticePage() {
  const supabase = createClient();
  const locale = await getCurrentLocale();

  const [noticesData, rulesRes, columnsRes, valuesRes] = await Promise.all([
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("notices")
          .select("*")
          .eq("category", "common")
          .eq("language", lang)
          .order("order_num", { ascending: true });
        return res.data ?? [];
      },
      locale,
    ),
    supabase
      .from("copyright_rules")
      .select("*")
      .order("order_num", { ascending: true }),
    supabase
      .from("copyright_columns")
      .select("*")
      .order("order_num", { ascending: true }),
    supabase.from("copyright_rule_values").select("*"),
  ]);

  if (rulesRes.error) {
    console.error("[notice] failed to fetch rules:", rulesRes.error.message);
  }
  if (columnsRes.error) {
    console.error("[notice] failed to fetch columns:", columnsRes.error.message);
  }
  if (valuesRes.error) {
    console.error("[notice] failed to fetch values:", valuesRes.error.message);
  }

  // 1섹션 = 1행 정책. 같은 섹션의 첫 번째 row 만 사용.
  const sectionMap = new Map<string, string>();
  for (const n of noticesData) {
    if (!sectionMap.has(n.section)) sectionMap.set(n.section, n.content);
  }

  const rules = rulesRes.data ?? [];
  const columns = columnsRes.data ?? [];
  const values = valuesRes.data ?? [];

  return (
    <main className="notice-shell">
      <ScrollProgress />
      <BackToTopButton />
      <div className="notice-container">
        <div className="notice-topbar">
          <Link href="/" className="notice-back" aria-label="메인으로 돌아가기">
            ← 메인으로
          </Link>
          <LanguageToggle current={locale} />
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
            // live2d/illust 와 동일하게 각 section 단위로 ScrollReveal.
            // hero(타이틀 + 부제)는 페이지 진입 즉시 보이도록 감싸지 않음 — 일관성 유지.
            <ScrollReveal key={key}>
              <section className="notice-section">
                <h2 className="notice-section-title">{title}</h2>
                <div className="notice-card">
                  {isGuide ? (
                    <CopyrightTable
                      rules={rules}
                      columns={columns}
                      values={values}
                      locale={locale}
                    />
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
            </ScrollReveal>
          );
        })}

        {/* 사용자가 notice 를 읽은 뒤 바로 신청 페이지로 이동할 수 있도록 하단 CTA.
            메인으로 돌아갔다 다시 진입하는 흐름의 마찰을 줄임. */}
        <ScrollReveal>
          <div className="notice-cta">
            <Link href="/live2d" className="notice-cta-btn notice-cta-btn-live2d">
              Live2D 신청하기
            </Link>
            <Link href="/illust" className="notice-cta-btn notice-cta-btn-illust">
              Illust 신청하기
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </main>
  );
}

function CopyrightTable({
  rules,
  columns,
  values,
  locale,
}: {
  rules: CopyrightRule[];
  columns: CopyrightColumn[];
  values: CopyrightRuleValue[];
  locale: Language;
}) {
  if (rules.length === 0 || columns.length === 0) {
    return <p className="notice-empty">준비 중입니다.</p>;
  }

  // (rule_id, column_id) → checked. 미존재 = false (열을 어드민이 새로 추가했지만
  // 해당 row 의 셀이 아직 생성되지 않은 경우의 안전 디폴트).
  const valueMap = new Map<string, boolean>();
  for (const v of values) {
    valueMap.set(`${v.rule_id}:${v.column_id}`, v.checked);
  }

  return (
    <div className="notice-table-wrap">
      <table className="notice-table">
        <thead>
          <tr>
            <th aria-hidden />
            {columns.map((c) => (
              <th key={c.id}>{pickColumnLabel(c, locale)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <th scope="row">{rule.label}</th>
              {columns.map((c) => {
                const allowed = valueMap.get(`${rule.id}:${c.id}`) ?? false;
                return (
                  <td key={c.id}>
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
