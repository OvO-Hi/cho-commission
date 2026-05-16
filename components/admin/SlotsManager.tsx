"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { CommissionCategory, Slot } from "@/types/database";

type OpenMap = { live2d: boolean; illust: boolean };

type Props = {
  initialSlots: Slot[];
  initialOpen: OpenMap;
};

const CATEGORIES: { id: CommissionCategory; label: string }[] = [
  { id: "live2d", label: "Live2D 슬롯" },
  { id: "illust", label: "Illust 슬롯" },
];

// settings 테이블의 key 컨벤션. settings 는 (key, language) 조합으로 관리.
function openKey(category: CommissionCategory) {
  return `${category}_open`;
}

export default function SlotsManager({ initialSlots, initialOpen }: Props) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [openMap, setOpenMap] = useState<OpenMap>(initialOpen);
  // 동시 mutation 방지용 단일 busy flag.
  const [busy, setBusy] = useState(false);
  // "신청 받기" 토글을 끄려 할 때 띄우는 확인 모달의 대상 카테고리.
  // 켤 때는 자동으로 슬롯이 열리지 않으므로 위험이 없어 confirm 없이 바로 진행.
  const [confirmingClose, setConfirmingClose] =
    useState<CommissionCategory | null>(null);

  // 서버가 router.refresh() 로 재요청되면 새 initial 로 동기화.
  useEffect(() => setSlots(initialSlots), [initialSlots]);
  useEffect(() => setOpenMap(initialOpen), [initialOpen]);

  // 확인 모달이 열려 있을 때 ESC 로 닫기.
  useEffect(() => {
    if (!confirmingClose) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setConfirmingClose(null);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmingClose, busy]);

  async function toggleSlot(slot: Slot) {
    if (busy) return;
    setBusy(true);
    const next = !slot.is_filled;
    // 낙관적 업데이트
    setSlots((prev) =>
      prev.map((s) => (s.id === slot.id ? { ...s, is_filled: next } : s)),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("slots")
      .update({ is_filled: next })
      .eq("id", slot.id);
    setBusy(false);
    if (error) {
      console.error("[admin/slots] toggle failed:", error.message);
      // 실패 시 롤백
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slot.id ? { ...s, is_filled: slot.is_filled } : s,
        ),
      );
      return;
    }
    router.refresh();
  }

  async function addSlot(category: CommissionCategory) {
    if (busy) return;
    setBusy(true);
    const existing = slots.filter((s) => s.category === category);
    const nextNumber =
      existing.length === 0
        ? 1
        : Math.max(...existing.map((s) => s.slot_number)) + 1;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("slots")
      .insert({
        category,
        slot_number: nextNumber,
        is_filled: false,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      console.error("[admin/slots] add failed:", error?.message);
      return;
    }
    setSlots((prev) => [...prev, data]);
    router.refresh();
  }

  async function deleteSlot(id: string) {
    if (busy) return;
    setBusy(true);
    // 낙관적: 즉시 UI 반영
    const removed = slots.find((s) => s.id === id);
    setSlots((prev) => prev.filter((s) => s.id !== id));

    const supabase = createClient();
    const { error } = await supabase.from("slots").delete().eq("id", id);
    setBusy(false);
    if (error) {
      console.error("[admin/slots] delete failed:", error.message);
      // 실패 시 복원
      if (removed) setSlots((prev) => [...prev, removed]);
      return;
    }
    router.refresh();
  }

  // 사용자가 토글을 클릭했을 때 진입 지점.
  //  - 켜는 방향: 자동 슬롯 변경 없음 (수동 오픈으로 안전 보장) → 바로 진행
  //  - 끄는 방향: 모집중 슬롯이 일괄 삭제되므로 confirm 필수
  function requestToggleOpen(category: CommissionCategory) {
    if (busy) return;
    const wantOpen = !openMap[category];
    if (!wantOpen) {
      setConfirmingClose(category);
      return;
    }
    void applyOpenChange(category, true);
  }

  // 실제 DB 반영 + 낙관적 UI 업데이트.
  // next === false 일 때만 모집중 슬롯을 일괄 삭제 (닫힘 슬롯은 신청 기록이 남아있으므로 보존).
  async function applyOpenChange(
    category: CommissionCategory,
    next: boolean,
  ) {
    if (busy) return;
    setBusy(true);

    const closingSlots = !next;
    setOpenMap((prev) => ({ ...prev, [category]: next }));

    // 닫는 경우 — 낙관적으로 모집중 슬롯을 화면에서 제거하고 원본을 백업해 둠(롤백용).
    let removedEmptySlots: Slot[] = [];
    if (closingSlots) {
      removedEmptySlots = slots.filter(
        (s) => s.category === category && !s.is_filled,
      );
      setSlots((prev) =>
        prev.filter((s) => !(s.category === category && !s.is_filled)),
      );
    }

    const supabase = createClient();

    // 1. settings 업데이트 (select → update | insert 패턴)
    const key = openKey(category);
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("key", key)
      .eq("language", "ko")
      .maybeSingle();

    // insert 시 translation_key 필수 (마이그레이션 002). 이 매니저는 ko 로만 저장하고
     // ko 의 같은 key 가 있으면 그 그룹을, 없으면 새 uuid 부여 — SettingsManager 와 동일.
    let translationKey: string | null = null;
    if (!existing) {
      const { data: koRow } = await supabase
        .from("settings")
        .select("translation_key")
        .eq("key", key)
        .eq("language", "ko")
        .maybeSingle();
      translationKey = koRow?.translation_key ?? crypto.randomUUID();
    }

    const settingResult = existing
      ? await supabase
          .from("settings")
          .update({ value: String(next) })
          .eq("id", existing.id)
      : await supabase
          .from("settings")
          .insert({
            key,
            value: String(next),
            language: "ko",
            translation_key: translationKey!,
          });

    // 2. 닫는 경우에만 모집중 슬롯 일괄 삭제.
    //    DELETE FROM slots WHERE category = ? AND is_filled = false
    //    닫힘(is_filled=true) 슬롯은 신청 기록 보존을 위해 유지.
    const slotsResult = closingSlots
      ? await supabase
          .from("slots")
          .delete()
          .eq("category", category)
          .eq("is_filled", false)
      : { error: null };

    setBusy(false);

    if (settingResult.error || slotsResult.error) {
      console.error(
        "[admin/settings] toggle failed:",
        settingResult.error?.message ?? slotsResult.error?.message,
      );
      // 롤백 — 토글 상태 + 삭제된 슬롯 복원
      setOpenMap((prev) => ({ ...prev, [category]: !next }));
      if (closingSlots && removedEmptySlots.length > 0) {
        setSlots((prev) => [...prev, ...removedEmptySlots]);
      }
      return;
    }
    router.refresh();
  }

  async function confirmCloseToggle() {
    if (!confirmingClose) return;
    const cat = confirmingClose;
    setConfirmingClose(null);
    await applyOpenChange(cat, false);
  }

  // 컨펌 메시지에서 사용할 카운트 — 모집중 슬롯이 몇 개 닫히는지 미리 알려줌.
  const closingEmptyCount = confirmingClose
    ? slots.filter((s) => s.category === confirmingClose && !s.is_filled).length
    : 0;

  return (
    <div className="admin-main-card">
      <h1 className="admin-main-title">슬롯 관리</h1>
      <p className="admin-slots-sub">
        각 슬롯을 클릭해 사용중/비어있음 상태를 변경할 수 있어요
      </p>

      <div className="admin-slots-sections">
        {CATEGORIES.map((cat) => {
          const list = slots
            .filter((s) => s.category === cat.id)
            .sort((a, b) => a.slot_number - b.slot_number);
          const isOpen = openMap[cat.id];

          return (
            <section key={cat.id} className="admin-slots-section">
              <h2 className="admin-slots-section-title">{cat.label}</h2>

              <div className="admin-slots-list">
                {list.map((slot) => (
                  <div key={slot.id} className="admin-slot-wrap">
                    <button
                      type="button"
                      className={`l2d-slot ${slot.is_filled ? "l2d-slot-filled" : "l2d-slot-empty"}`}
                      onClick={() => toggleSlot(slot)}
                      disabled={busy}
                    >
                      {slot.is_filled ? "닫힘" : "모집중"}
                    </button>
                    <button
                      type="button"
                      className="admin-slot-remove"
                      onClick={() => deleteSlot(slot.id)}
                      aria-label="슬롯 삭제"
                      disabled={busy}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="admin-slot-add"
                  onClick={() => addSlot(cat.id)}
                  aria-label="슬롯 추가"
                  disabled={busy}
                >
                  +
                </button>
              </div>

              <div className="admin-slots-section-footer">
                <button
                  type="button"
                  className={`admin-toggle${isOpen ? " admin-toggle-on" : ""}`}
                  onClick={() => requestToggleOpen(cat.id)}
                  disabled={busy}
                  aria-pressed={isOpen}
                >
                  <span className="admin-toggle-track" aria-hidden />
                  <span
                    className={`admin-toggle-label${isOpen ? "" : " admin-toggle-label-off"}`}
                  >
                    {isOpen ? "현재 신청을 받고 있어요" : "신청을 받지 않아요"}
                  </span>
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {confirmingClose && (
        <div
          className="admin-confirm-overlay"
          onClick={() => !busy && setConfirmingClose(null)}
          role="presentation"
        >
          <div
            className="admin-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h3 className="admin-confirm-title">신청 받기를 끌까요?</h3>
            <p className="admin-confirm-msg">
              {closingEmptyCount > 0
                ? `모집중인 슬롯 ${closingEmptyCount}개가 삭제됩니다. 계속할까요?`
                : "모집중인 슬롯이 모두 삭제됩니다. 계속할까요?"}
              <br />
              <span className="admin-confirm-sub">
                닫힘 슬롯은 신청 기록 보존을 위해 그대로 유지됩니다.
              </span>
            </p>
            <div className="admin-confirm-actions">
              <button
                type="button"
                className="admin-action-btn"
                onClick={() => setConfirmingClose(null)}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="button"
                className="admin-action-btn admin-action-btn-primary"
                onClick={confirmCloseToggle}
                disabled={busy}
              >
                {busy ? "처리 중..." : "계속"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
