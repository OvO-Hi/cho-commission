import Link from "next/link";

import BackToTopButton from "@/components/BackToTopButton";
import CommissionFormCTA from "@/components/CommissionFormCTA";
import Live2DCommissionForm from "@/components/Live2DCommissionForm";
import ProcessTimeline from "@/components/ProcessTimeline";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollReveal from "@/components/ScrollReveal";
import { createClient } from "@/lib/supabase/server";

// 어드민의 슬롯/오픈 설정 변경이 즉시 반영되도록 캐싱 비활성화.
export const dynamic = "force-dynamic";

// 가격은 어드민 페이지(/admin/dashboard/pricing) 에서 관리. price_items 테이블 fetch.

// 작업 과정 / 작업 타입 안내는 어드민 페이지(/admin/dashboard/process) 에서 관리.

const krw = new Intl.NumberFormat("ko-KR");

// 폼이 보일 수 있는 4가지 상태.
type FormStatus = "open" | "closed" | "no-slots" | "all-filled";

const STATUS_MESSAGE: Record<Exclude<FormStatus, "open">, string> = {
  closed: "지금은 신청을 받고 있지 않아요",
  "no-slots": "모집중인 슬롯이 없어요",
  "all-filled": "모든 슬롯이 마감되었어요",
};

export default async function Live2DPage() {
  const supabase = createClient();

  const [
    slotsRes,
    openRes,
    pricingRes,
    stepsRes,
    typesRes,
    typeItemsRes,
  ] = await Promise.all([
    supabase
      .from("slots")
      .select("is_filled,slot_number")
      .eq("category", "live2d")
      .order("slot_number", { ascending: true }),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "live2d_open")
      .eq("language", "ko")
      .maybeSingle(),
    supabase
      .from("price_items")
      .select("*")
      .eq("category", "live2d")
      .eq("language", "ko")
      .order("order_num", { ascending: true }),
    supabase
      .from("process_steps")
      .select("*")
      .eq("category", "live2d")
      .eq("language", "ko")
      .order("step_num", { ascending: true }),
    supabase
      .from("live2d_types")
      .select("*")
      .eq("language", "ko")
      .order("order_num", { ascending: true }),
    supabase
      .from("live2d_type_items")
      .select("*")
      .order("order_num", { ascending: true }),
  ]);

  const processSteps = stepsRes.data ?? [];
  const allTypeItems = typeItemsRes.data ?? [];
  // 각 type 에 자식 items 를 붙여 한 객체로 만들어 렌더에 전달.
  const live2dTypes = (typesRes.data ?? []).map((t) => ({
    ...t,
    items: allTypeItems.filter((item) => item.type_id === t.id),
  }));

  const priceItems = pricingRes.data ?? [];
  const liveMains = priceItems.filter((i) => !i.is_addon);
  const liveAddons = priceItems.filter((i) => i.is_addon);

  const slotState = (slotsRes.data ?? []).map((s) => s.is_filled);
  // 설정이 없으면 'open' 으로 간주(기본 열림). 명시적으로 'false' 일 때만 닫힘.
  const isOpen = openRes.data?.value !== "false";

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
      <BackToTopButton />
      <CommissionFormCTA targetId="commission-form" />
      <div className="l2d-container">
        <div className="l2d-topbar">
          <Link href="/" className="l2d-back" aria-label="메인으로 돌아가기">
            ← 메인으로
          </Link>
        </div>

        <header className="l2d-hero">
          <h1 className="l2d-hero-title">Live2D</h1>
          <p className="l2d-hero-sub">버츄얼 리깅 커미션 안내</p>
        </header>

        {/* 샘플 CTA + 슬롯 현황을 한 줄에 배치.
            좌측은 샘플 페이지 진입 버튼, 우측은 신청 가능 슬롯 시각화로
            "안내 콘텐츠를 보기 전에 결과물 확인 / 가용성 확인" 두 핵심 정보를 한 곳에서 노출합니다. */}
        <div className="l2d-sample-cta">
          <Link href="/live2d/sample" className="l2d-sample-btn">
            샘플 보러가기 →
          </Link>

          {/* 슬롯이 0개면 시각화할 데이터가 없어 슬롯 그룹 자체를 숨김. */}
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

        {/* 1. 작업 과정 — 세로 타임라인 */}
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

        {/* 2. 작업 타입 안내 — live2d_types + live2d_type_items 의 label/value 행. */}
        {live2dTypes.length > 0 && (
          <ScrollReveal>
            <section className="l2d-section">
              <h2 className="l2d-section-title">작업 타입 안내</h2>
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
          <h2 className="l2d-section-title">가격 안내</h2>
          {liveMains.length === 0 ? (
            <div className="l2d-card l2d-form-placeholder">
              <p>가격 정보가 준비 중입니다.</p>
            </div>
          ) : (
            <>
              <div className="l2d-grid-2">
                {liveMains.map((main) => {
                  return (
                    <article
                      key={main.id}
                      className="l2d-card l2d-pricecard"
                    >
                      <h3 className="l2d-pricecard-title">{main.item_name}</h3>
                      <div className="l2d-pricecard-header">
                        <p className="l2d-pricecard-amount">
                          ₩{krw.format(main.price)}
                        </p>
                        {main.description && (
                          <p className="l2d-pricecard-base">
                            ({main.description} 기준)
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {liveAddons.length > 0 && (
                <article className="l2d-card l2d-pricecard l2d-pricecard-addons">
                  <h3 className="l2d-pricecard-title">추가금 옵션</h3>
                  <ul className="l2d-pricecard-list">
                    {liveAddons.map((addon) => (
                      <li key={addon.id} className="l2d-pricecard-item">
                        <span className="l2d-pricecard-label">
                          {addon.item_name}
                          {addon.description ? ` (${addon.description})` : ""}
                        </span>
                        <span className="l2d-pricecard-add">
                          +{krw.format(addon.price)}원
                          {addon.is_approx ? "~" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </>
          )}
        </section>
        </ScrollReveal>

        {/* 4. 신청서 작성. formStatus 에 따라 폼 또는 안내 메시지를 분기 렌더.
            id="commission-form" 은 CommissionFormCTA 의 IntersectionObserver 타깃. */}
        <ScrollReveal>
          <section id="commission-form" className="l2d-section">
            <h2 className="l2d-section-title">신청서 작성</h2>
            {formStatus === "open" ? (
              <Live2DCommissionForm />
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
