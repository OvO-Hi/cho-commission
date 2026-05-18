import Link from "next/link";

import BackToTopButton from "@/components/BackToTopButton";
import CommissionFormCTA from "@/components/CommissionFormCTA";
import LanguageToggle from "@/components/LanguageToggle";
import Live2DCommissionForm from "@/components/Live2DCommissionForm";
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

// 어드민의 슬롯/오픈 설정 변경이 즉시 반영되도록 캐싱 비활성화.
export const dynamic = "force-dynamic";

// 가격은 어드민 페이지(/admin/dashboard/pricing) 에서 관리. price_items 테이블 fetch.

// 작업 과정 / 작업 타입 안내는 어드민 페이지(/admin/dashboard/process) 에서 관리.

// 메인 카드 안 추가금 섹션 부제목 — 페이지 locale 기준 분기 (formatPrice 와 다름).
const ADDON_LABEL: Record<Language, string> = {
  ko: "추가금",
  en: "Add-ons",
  jp: "オプション",
};

// 폼이 보일 수 있는 4가지 상태.
type FormStatus = "open" | "closed" | "no-slots" | "all-filled";

export default async function Live2DPage() {
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
    liveMains,
    liveAddonsIllust,
    liveAddonsRigging,
    processSteps,
    types,
    typeItems,
  ] = await Promise.all([
    supabase
      .from("slots")
      .select("is_filled,slot_number")
      .eq("category", "live2d")
      .order("slot_number", { ascending: true }),
    fetchSingleWithFallback(
      async (lang) => {
        const res = await supabase
          .from("settings")
          .select("value")
          .eq("key", "live2d_open")
          .eq("language", lang)
          .maybeSingle();
        return res.data ?? null;
      },
      locale,
    ),
    // 메인 가격 + 메인 타입별 추가금 (illust/rigging) 을 각각 별도 fetch.
    // fetchListWithFallback 가 list 전체 단위 fallback 이라 합쳐 fetch 하면
    // 한 그룹만 비어있는 locale 에서 그 그룹이 KO fallback 분기를 못 타고 사라짐.
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("price_items")
          .select("*")
          .eq("category", "live2d")
          .eq("is_addon", false)
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
          .eq("category", "live2d")
          .eq("is_addon", true)
          .eq("main_type", "illust")
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
          .eq("category", "live2d")
          .eq("is_addon", true)
          .eq("main_type", "rigging")
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
          .eq("category", "live2d")
          .eq("language", lang)
          .order("step_num", { ascending: true });
        return res.data ?? [];
      },
      locale,
    ),
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("live2d_types")
          .select("*")
          .eq("language", lang)
          .order("order_num", { ascending: true });
        return res.data ?? [];
      },
      locale,
    ),
    // live2d_type_items 는 008 에서 translation_key + language 추가. 부모와 같은
    // language 로 자식이 따라온다 (KO 자식 → KO 부모, EN 자식 → EN 부모).
    // 비어있으면 KO fallback — 위의 types fetch 도 같은 정책이라 매핑이 어긋나지 않음.
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("live2d_type_items")
          .select("*")
          .eq("language", lang)
          .order("order_num", { ascending: true });
        return res.data ?? [];
      },
      locale,
    ),
  ]);

  // 각 type 에 자식 items 를 붙여 한 객체로 만들어 렌더에 전달.
  const live2dTypes = types.map((t) => ({
    ...t,
    items: typeItems.filter((item) => item.type_id === t.id),
  }));

  const slotState = (slotsRes.data ?? []).map((s) => s.is_filled);
  // 설정이 없으면 'open' 으로 간주(기본 열림). 명시적으로 'false' 일 때만 닫힘.
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
          <h1 className="l2d-hero-title">Live2D</h1>
          <p className="l2d-hero-sub">{pageMessages.live2d_subtitle}</p>
        </header>

        {/* 샘플 CTA + 슬롯 현황을 한 줄에 배치.
            좌측은 샘플 페이지 진입 버튼, 우측은 신청 가능 슬롯 시각화로
            "안내 콘텐츠를 보기 전에 결과물 확인 / 가용성 확인" 두 핵심 정보를 한 곳에서 노출합니다. */}
        <div className="l2d-sample-cta">
          <Link href="/live2d/sample" className="l2d-sample-btn">
            {pageMessages.view_samples}
          </Link>

          {/* 슬롯이 0개면 시각화할 데이터가 없어 슬롯 그룹 자체를 숨김. */}
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

        {/* 1. 작업 과정 — 세로 타임라인 */}
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

        {/* 2. 작업 타입 안내 — live2d_types + live2d_type_items 의 label/value 행. */}
        {live2dTypes.length > 0 && (
          <ScrollReveal>
            <section className="l2d-section">
              <h2 className="l2d-section-title">{pageMessages.section_type}</h2>
              <div className="l2d-grid-2">
                {live2dTypes.map((type) => (
                  <article key={type.id} className="l2d-card l2d-type-card">
                    <h3 className="l2d-type-title">{type.title}</h3>
                    <ul className="l2d-type-list">
                      {type.items.map((item) => (
                        <li key={item.id} className="l2d-type-item">
                          <span className="l2d-type-label">
                            {item.label ?? "·"}
                          </span>
                          <span className="l2d-type-value">{item.value}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* 3. 가격 안내 — 메인 카드들 + 공통 추가금 카드. 어드민 가격 관리 페이지에서 관리. */}
        <ScrollReveal>
        <section className="l2d-section">
          <h2 className="l2d-section-title">{pageMessages.section_price}</h2>
          {liveMains.length === 0 ? (
            <div className="l2d-card l2d-form-placeholder">
              <p>{pageMessages.price_preparing}</p>
            </div>
          ) : (
            <div className="l2d-grid-2">
              {liveMains.map((main) => {
                // 메인 카드의 main_type 에 맞는 추가금 묶기. 일러스트/리깅 외
                // (main_type=null 등) 의 메인 row 는 추가금 섹션 자체를 노출 안 함.
                const cardAddons =
                  main.main_type === "illust"
                    ? liveAddonsIllust
                    : main.main_type === "rigging"
                      ? liveAddonsRigging
                      : [];
                return (
                  <article key={main.id} className="l2d-card l2d-pricecard">
                    <h3 className="l2d-pricecard-title">{main.item_name}</h3>
                    <div className="l2d-pricecard-header">
                      <p className="l2d-pricecard-amount">
                        {formatPrice(main.price, main.language)}
                      </p>
                      {main.description && (
                        <p className="l2d-pricecard-base">
                          ({main.description})
                        </p>
                      )}
                    </div>

                    {cardAddons.length > 0 && (
                      <>
                        <hr className="l2d-pricecard-divider" />
                        <h4 className="l2d-pricecard-addon-title">
                          {ADDON_LABEL[locale]}
                        </h4>
                        <ul className="l2d-pricecard-list">
                          {cardAddons.map((addon) => (
                            <li
                              key={addon.id}
                              className="l2d-pricecard-item"
                            >
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
                );
              })}
            </div>
          )}
        </section>
        </ScrollReveal>

        {/* 4. 신청서 작성. formStatus 에 따라 폼 또는 안내 메시지를 분기 렌더.
            id="commission-form" 은 CommissionFormCTA 의 IntersectionObserver 타깃. */}
        <ScrollReveal>
          <section id="commission-form" className="l2d-section">
            <h2 className="l2d-section-title">{pageMessages.section_form}</h2>
            {formStatus === "open" ? (
              <NoticeAgreementGate locale={locale}>
                <Live2DCommissionForm locale={locale} />
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
