import Link from "next/link";

import BackToTopButton from "@/components/BackToTopButton";
import CommissionFormCTA from "@/components/CommissionFormCTA";
import IllustCommissionForm from "@/components/IllustCommissionForm";
import LanguageToggle from "@/components/LanguageToggle";
import NoticeAgreementGate from "@/components/NoticeAgreementGate";
import ProcessTimeline from "@/components/ProcessTimeline";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import {
  fetchListWithFallback,
  fetchSingleWithFallback,
} from "@/lib/i18n/fetchWithFallback";
import { formatPrice } from "@/lib/i18n/formatPrice";
import { getCurrentLocale } from "@/lib/i18n/locale";
import {
  formatSlotCount,
  formatSlotItemAria,
  getPageMessages,
} from "@/lib/i18n/page-messages";
import type { Language } from "@/types/database";

export const dynamic = "force-dynamic";

// 가격은 어드민 페이지(/admin/dashboard/pricing) 에서 관리. price_items 테이블 fetch.

// subcategory 라벨은 페이지 locale 기준 분기 (formatPrice 와 다르게 데이터의
// language 가 아님 — 라벨은 페이지 표시용이라 사용자가 보는 언어로 통일).
const SUBCATEGORY_LABEL: Record<Language, Record<"broadcast" | "commercial", string>> = {
  ko: { broadcast: "방송용 일러스트", commercial: "상업용 일러스트" },
  en: { broadcast: "Broadcasting", commercial: "Commercial" },
  jp: { broadcast: "放送用", commercial: "商用" },
};

// 작업 과정은 어드민 페이지(/admin/dashboard/process) 에서 관리.

type FormStatus = "open" | "closed" | "no-slots" | "all-filled";

export default async function IllustPage() {
  const supabase = createClient();
  const locale = await getCurrentLocale();
  const pageMessages = getPageMessages(locale);
  const statusMessage: Record<Exclude<FormStatus, "open">, string> = {
    closed: pageMessages.status_closed,
    "no-slots": pageMessages.status_no_slots,
    "all-filled": pageMessages.status_all_filled,
  };

  const [
    slotsRes,
    openSetting,
    broadcastMains,
    commercialMains,
    illustAddons,
    processSteps,
  ] = await Promise.all([
    supabase
      .from("slots")
      .select("is_filled,slot_number")
      .eq("category", "illust")
      .order("slot_number", { ascending: true }),
    fetchSingleWithFallback(
      async (lang) => {
        const res = await supabase
          .from("settings")
          .select("value")
          .eq("key", "illust_open")
          .eq("language", lang)
          .maybeSingle();
        return res.data ?? null;
      },
      locale,
    ),
    // 가격 그룹(방송용 메인 / 상업용 메인 / 추가금)을 각각 별도 쿼리로 분리.
    // fetchListWithFallback 가 list 전체 단위 fallback 이라, 합쳐서 fetch 하면
    // 한 그룹만 비어있는 locale 에서 그 그룹이 KO fallback 분기를 못 타고 사라짐.
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("price_items")
          .select("*")
          .eq("category", "illust")
          .eq("is_addon", false)
          .eq("subcategory", "broadcast")
          .eq("language", lang)
          .order("order_num", { ascending: true });
        return res.data ?? [];
      },
      locale,
    ),
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("price_items")
          .select("*")
          .eq("category", "illust")
          .eq("is_addon", false)
          .eq("subcategory", "commercial")
          .eq("language", lang)
          .order("order_num", { ascending: true });
        return res.data ?? [];
      },
      locale,
    ),
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("price_items")
          .select("*")
          .eq("category", "illust")
          .eq("is_addon", true)
          .eq("language", lang)
          .order("order_num", { ascending: true });
        return res.data ?? [];
      },
      locale,
    ),
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("process_steps")
          .select("*")
          .eq("category", "illust")
          .eq("language", lang)
          .order("step_num", { ascending: true });
        return res.data ?? [];
      },
      locale,
    ),
  ]);

  const tierCards = [
    {
      key: "broadcast" as const,
      mains: broadcastMains,
    },
    {
      key: "commercial" as const,
      mains: commercialMains,
    },
  ].filter((t) => t.mains.length > 0);

  const slotState = (slotsRes.data ?? []).map((s) => s.is_filled);
  const isOpen = openSetting?.value !== "false";

  const emptyCount = slotState.filter((v) => !v).length;
  const noSlots = slotState.length === 0;
  const allFilled = !noSlots && emptyCount === 0;

  const formStatus: FormStatus = !isOpen
    ? "closed"
    : noSlots
      ? "no-slots"
      : allFilled
        ? "all-filled"
        : "open";
  return (
    // chrome 클래스(.l2d-*) 는 Live2D 페이지와 공유합니다 — 톤이 동일해
    // 페이지마다 별도 namespace 를 두기보다 한 세트를 재사용하는 게 유지보수에 효율적.
    <main className="l2d-shell">
      <ScrollProgress />
      <BackToTopButton locale={locale} />
      <CommissionFormCTA targetId="commission-form" locale={locale} />
      <div className="l2d-container">
        <div className="l2d-topbar">
          <Link
            href="/"
            className="l2d-back"
            aria-label={pageMessages.back_to_main_aria}
          >
            {pageMessages.back_to_main}
          </Link>
          <LanguageToggle current={locale} />
        </div>

        <header className="l2d-hero">
          <h1 className="l2d-hero-title">Illust</h1>
          <p className="l2d-hero-sub">{pageMessages.illust_subtitle}</p>
        </header>

        {/* 샘플 CTA + 슬롯 */}
        <div className="l2d-sample-cta">
          <Link href="/illust/sample" className="l2d-sample-btn">
            {pageMessages.view_samples}
          </Link>

          {slotState.length > 0 && (
            <div className="l2d-slot-group">
              <div className="l2d-slot-headline">
                <span className="l2d-slot-label">
                  {pageMessages.available_slots}
                </span>
                <span className="l2d-slot-badge">
                  {formatSlotCount(locale, emptyCount)}
                </span>
              </div>
              <ul
                className="l2d-slot-list"
                aria-label={pageMessages.slot_status_list_aria}
              >
                {slotState.map((isFilled, idx) => (
                  <li
                    key={idx}
                    className={`l2d-slot${isFilled ? " l2d-slot-filled" : " l2d-slot-empty"}`}
                    aria-label={formatSlotItemAria(locale, idx + 1, isFilled)}
                  >
                    {isFilled ? pageMessages.slot_closed : pageMessages.slot_open}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 1. 작업 과정 */}
        <ScrollReveal>
          <section className="l2d-section">
            <h2 className="l2d-section-title">{pageMessages.section_process}</h2>
            <div className="l2d-card">
              <ProcessTimeline steps={processSteps} />
              <p className="l2d-timeline-note">
                {pageMessages.process_revision_note}
              </p>
            </div>
          </section>
        </ScrollReveal>

        {/* 2. 가격 안내 — subcategory 별 카드(방송용/상업용). 어드민 가격 관리에서 관리. */}
        <ScrollReveal>
        <section className="l2d-section">
          <h2 className="l2d-section-title">{pageMessages.section_price}</h2>
          {tierCards.length === 0 ? (
            <div className="l2d-card l2d-form-placeholder">
              <p>{pageMessages.price_preparing}</p>
            </div>
          ) : (
            <div className="l2d-grid-2">
              {tierCards.map((tier) => (
                <article
                  key={tier.key}
                  className="l2d-card l2d-pricecard"
                >
                  <h3 className="l2d-pricecard-title">
                    {SUBCATEGORY_LABEL[locale][tier.key]}
                  </h3>

                  <ul className="l2d-pricecard-bases">
                    {tier.mains.map((bp) => (
                      <li key={bp.id} className="l2d-pricecard-base-row">
                        <span className="l2d-pricecard-base-label">
                          {bp.item_name}
                          {bp.description ? ` (${bp.description})` : ""}
                        </span>
                        <span className="l2d-pricecard-base-amount">
                          {formatPrice(bp.price, bp.language)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {illustAddons.length > 0 && (
                    <>
                      <hr className="l2d-pricecard-divider" />
                      <ul className="l2d-pricecard-list">
                        {illustAddons.map((addon) => (
                          <li key={addon.id} className="l2d-pricecard-item">
                            <span className="l2d-pricecard-label">
                              {addon.item_name}
                              {addon.description
                                ? ` (${addon.description})`
                                : ""}
                            </span>
                            <span className="l2d-pricecard-add">
                              {formatPrice(addon.price, addon.language, {
                                isAddon: true,
                                isApprox: addon.is_approx,
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        </ScrollReveal>

        {/* 3. 신청서 작성. id="commission-form" 은 CommissionFormCTA 의 IntersectionObserver 타깃. */}
        <ScrollReveal>
          <section id="commission-form" className="l2d-section">
            <h2 className="l2d-section-title">{pageMessages.section_form}</h2>
            {formStatus === "open" ? (
              <NoticeAgreementGate locale={locale}>
                <IllustCommissionForm locale={locale} />
              </NoticeAgreementGate>
            ) : (
              <div className="l2d-card l2d-form-placeholder">
                <p>{statusMessage[formStatus]}</p>
              </div>
            )}
          </section>
        </ScrollReveal>
      </div>
    </main>
  );
}
