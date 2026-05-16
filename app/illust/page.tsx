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
import { getCurrentLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

// 가격은 어드민 페이지(/admin/dashboard/pricing) 에서 관리. price_items 테이블 fetch.

const SUBCATEGORY_LABEL: Record<string, string> = {
  broadcast: "방송용 일러스트",
  commercial: "상업용 일러스트",
};

// 작업 과정은 어드민 페이지(/admin/dashboard/process) 에서 관리.

const krw = new Intl.NumberFormat("ko-KR");

type FormStatus = "open" | "closed" | "no-slots" | "all-filled";

const STATUS_MESSAGE: Record<Exclude<FormStatus, "open">, string> = {
  closed: "지금은 신청을 받고 있지 않아요",
  "no-slots": "모집중인 슬롯이 없어요",
  "all-filled": "모든 슬롯이 마감되었어요",
};

export default async function IllustPage() {
  const supabase = createClient();
  const locale = await getCurrentLocale();

  const [slotsRes, openSetting, priceItems, processSteps] = await Promise.all([
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
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("price_items")
          .select("*")
          .eq("category", "illust")
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
  // 메인은 subcategory 별로 그룹화 (broadcast / commercial). 추가금은 공통.
  const broadcastMains = priceItems.filter(
    (i) => !i.is_addon && i.subcategory === "broadcast",
  );
  const commercialMains = priceItems.filter(
    (i) => !i.is_addon && i.subcategory === "commercial",
  );
  const illustAddons = priceItems.filter((i) => i.is_addon);

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
      <BackToTopButton />
      <CommissionFormCTA targetId="commission-form" />
      <div className="l2d-container">
        <div className="l2d-topbar">
          <Link href="/" className="l2d-back" aria-label="메인으로 돌아가기">
            ← 메인으로
          </Link>
          <LanguageToggle current={locale} />
        </div>

        <header className="l2d-hero">
          <h1 className="l2d-hero-title">Illust</h1>
          <p className="l2d-hero-sub">일러스트 커미션 안내</p>
        </header>

        {/* 샘플 CTA + 슬롯 */}
        <div className="l2d-sample-cta">
          <Link href="/illust/sample" className="l2d-sample-btn">
            샘플 보러가기 →
          </Link>

          {slotState.length > 0 && (
            <div className="l2d-slot-group">
              <div className="l2d-slot-headline">
                <span className="l2d-slot-label">신청 가능 슬롯</span>
                <span className="l2d-slot-badge">{emptyCount}개</span>
              </div>
              <ul className="l2d-slot-list" aria-label="신청 가능 슬롯 현황">
                {slotState.map((isFilled, idx) => (
                  <li
                    key={idx}
                    className={`l2d-slot${isFilled ? " l2d-slot-filled" : " l2d-slot-empty"}`}
                    aria-label={`슬롯 ${idx + 1}: ${isFilled ? "닫힘" : "모집중"}`}
                  >
                    {isFilled ? "닫힘" : "모집중"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 1. 작업 과정 */}
        <ScrollReveal>
          <section className="l2d-section">
            <h2 className="l2d-section-title">작업 과정</h2>
            <div className="l2d-card">
              <ProcessTimeline steps={processSteps} />
              <p className="l2d-timeline-note">
                * 총 2회 수정이 가능하니 참고해주시길 바랍니다.
              </p>
            </div>
          </section>
        </ScrollReveal>

        {/* 2. 가격 안내 — subcategory 별 카드(방송용/상업용). 어드민 가격 관리에서 관리. */}
        <ScrollReveal>
        <section className="l2d-section">
          <h2 className="l2d-section-title">가격 안내</h2>
          {tierCards.length === 0 ? (
            <div className="l2d-card l2d-form-placeholder">
              <p>가격 정보가 준비 중입니다.</p>
            </div>
          ) : (
            <div className="l2d-grid-2">
              {tierCards.map((tier) => (
                <article
                  key={tier.key}
                  className="l2d-card l2d-pricecard"
                >
                  <h3 className="l2d-pricecard-title">
                    {SUBCATEGORY_LABEL[tier.key]}
                  </h3>

                  <ul className="l2d-pricecard-bases">
                    {tier.mains.map((bp) => (
                      <li key={bp.id} className="l2d-pricecard-base-row">
                        <span className="l2d-pricecard-base-label">
                          {bp.item_name}
                          {bp.description ? ` (${bp.description})` : ""}
                        </span>
                        <span className="l2d-pricecard-base-amount">
                          ₩{krw.format(bp.price)}
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
                              +{krw.format(addon.price)}원
                              {addon.is_approx ? "~" : ""}
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
            <h2 className="l2d-section-title">신청서 작성</h2>
            {formStatus === "open" ? (
              <NoticeAgreementGate>
                <IllustCommissionForm />
              </NoticeAgreementGate>
            ) : (
              <div className="l2d-card l2d-form-placeholder">
                <p>{STATUS_MESSAGE[formStatus]}</p>
              </div>
            )}
          </section>
        </ScrollReveal>
      </div>
    </main>
  );
}
