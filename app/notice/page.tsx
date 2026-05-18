import Link from "next/link";

import BackToTopButton from "@/components/BackToTopButton";
import LanguageToggle from "@/components/LanguageToggle";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";
import { sanitizeRich } from "@/lib/utils/sanitize";
import { createClient } from "@/lib/supabase/server";
import { fetchListWithFallback } from "@/lib/i18n/fetchWithFallback";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPageMessages, type PageMessages } from "@/lib/i18n/page-messages";
import type {
  CopyrightColumn,
  CopyrightRule,
  CopyrightRuleValue,
  Language,
  NoticeSection,
} from "@/types/database";

export const dynamic = "force-dynamic";

function getRichSections(
  m: PageMessages,
): { key: NoticeSection; title: string }[] {
  return [
    { key: "intro", title: m.notice_section_intro },
    { key: "notice", title: m.notice_section_notice },
    { key: "guide", title: m.notice_section_copyright },
    { key: "refund", title: m.notice_section_refund },
  ];
}

// 현재 노출 언어에서 열 라벨 추출. label_xx 가 NULL/빈문자열이면 label_ko 로 fallback.
function pickColumnLabel(column: CopyrightColumn, locale: Language): string {
  if (locale === "en") return column.label_en?.trim() || column.label_ko;
  if (locale === "jp") return column.label_jp?.trim() || column.label_ko;
  return column.label_ko;
}

// 행 라벨도 같은 패턴 — copyright_rules.label 이 ko, label_en/jp 가 nullable.
function pickRuleLabel(rule: CopyrightRule, locale: Language): string {
  if (locale === "en") return rule.label_en?.trim() || rule.label;
  if (locale === "jp") return rule.label_jp?.trim() || rule.label;
  return rule.label;
}

export default async function NoticePage() {
  const supabase = createClient();
  const locale = await getCurrentLocale();
  const pageMessages = getPageMessages(locale);
  const richSections = getRichSections(pageMessages);

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
      <BackToTopButton locale={locale} />
      <div className="notice-container">
        <div className="notice-topbar">
          <Link
            href="/"
            className="notice-back"
            aria-label={pageMessages.back_to_main_aria}
          >
            {pageMessages.back_to_main}
          </Link>
          <LanguageToggle current={locale} />
        </div>

        <header className="notice-hero">
          <h1 className="notice-hero-title">Notice</h1>
          <p className="notice-hero-sub">{pageMessages.notice_subtitle}</p>
        </header>

        {richSections.map(({ key, title }) => {
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
                    <p className="notice-empty">{pageMessages.notice_empty}</p>
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
              {pageMessages.notice_apply_live2d}
            </Link>
            <Link href="/illust" className="notice-cta-btn notice-cta-btn-illust">
              {pageMessages.notice_apply_illust}
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
  const m = getPageMessages(locale);
  if (rules.length === 0 || columns.length === 0) {
    return <p className="notice-empty">{m.notice_empty}</p>;
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
              <th scope="row">{pickRuleLabel(rule, locale)}</th>
              {columns.map((c) => {
                const allowed = valueMap.get(`${rule.id}:${c.id}`) ?? false;
                return (
                  <td key={c.id}>
                    {allowed ? (
                      <span
                        className="notice-mark notice-mark-o"
                        aria-label={m.notice_cell_yes_aria}
                      >
                        O
                      </span>
                    ) : (
                      <span
                        className="notice-mark notice-mark-x"
                        aria-label={m.notice_cell_no_aria}
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
