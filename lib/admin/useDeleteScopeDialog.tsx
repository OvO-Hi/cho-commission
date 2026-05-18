"use client";

// 다국어 row 삭제 시 사용자에게 "다른 언어 번역본도 함께 삭제할까요?" 를 묻는 hook.
//
// 사용 패턴:
//   const { ask, portal } = useDeleteScopeDialog();
//   const scope = await ask({ supabase, table, translationKey, currentLocale, itemHint });
//   if (scope === "cancelled") return;
//   // scope === "all"  → 같은 translation_key 의 모든 row delete
//   // scope === "current-only" → 현재 row 만 delete
//
// 분기:
//   currentLocale !== "ko" → 단순 window.confirm (다국어 영향 X)
//   ko + sibling==0       → 단순 window.confirm
//   ko + sibling > 0      → 3택 모달 (Portal 로 body 끝에 렌더)

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Language } from "@/types/database";

export type DeleteScope = "all" | "current-only" | "cancelled";

export type TranslatedTable =
  | "settings"
  | "notices"
  | "process_steps"
  | "price_items"
  | "live2d_types";

type AskArgs = {
  supabase: SupabaseClient<Database>;
  table: TranslatedTable;
  translationKey: string;
  currentLocale: Language;
  itemHint?: string;
};

type PendingDialog = {
  itemHint?: string;
  siblingCount: number;
  resolve: (scope: DeleteScope) => void;
};

export function useDeleteScopeDialog(): {
  ask: (args: AskArgs) => Promise<DeleteScope>;
  portal: ReactNode;
} {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 모달 열려있을 때 body 스크롤 잠금.
  useEffect(() => {
    if (!pending) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [pending]);

  async function ask(args: AskArgs): Promise<DeleteScope> {
    const { supabase, table, translationKey, currentLocale, itemHint } = args;
    const hint = itemHint ? `"${itemHint}" 항목` : "이 항목";

    // EN/JP 탭 — 다국어 영향 없으니 단순 confirm.
    if (currentLocale !== "ko") {
      return window.confirm(
        `${hint}을 삭제하시겠어요?\n현재 언어 항목만 삭제되며, 다른 언어 번역본은 유지됩니다.`,
      )
        ? "current-only"
        : "cancelled";
    }

    // KO 탭 — sib count 조회
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("translation_key", translationKey)
      .neq("language", "ko");
    if (error) {
      console.error("[useDeleteScopeDialog] sibling lookup failed:", error.message);
    }
    const siblingCount = data?.length ?? 0;

    // sib 없으면 단순 confirm
    if (siblingCount === 0) {
      return window.confirm(`${hint}을 삭제하시겠어요?`)
        ? "current-only"
        : "cancelled";
    }

    // sib 있음 — 3택 모달 (Promise)
    return new Promise<DeleteScope>((resolve) => {
      setPending({ itemHint, siblingCount, resolve });
    });
  }

  function close(scope: DeleteScope) {
    if (pending) pending.resolve(scope);
    setPending(null);
  }

  const modal =
    mounted && pending
      ? createPortal(
          <div
            className="admin-confirm-modal-overlay"
            role="presentation"
            onClick={() => close("cancelled")}
          >
            <div
              className="admin-confirm-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-delete-scope-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="admin-delete-scope-title"
                className="admin-confirm-modal-title"
              >
                다른 언어 번역본도 함께 삭제할까요?
              </h2>
              <p className="admin-confirm-modal-text">
                {pending.itemHint
                  ? `"${pending.itemHint}" 항목의 `
                  : "이 항목의 "}
                다른 언어 번역본 {pending.siblingCount}개가 있어요.
              </p>
              <div className="admin-confirm-modal-actions">
                <button
                  type="button"
                  className="admin-confirm-modal-btn"
                  onClick={() => close("cancelled")}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="admin-confirm-modal-btn"
                  onClick={() => close("current-only")}
                >
                  한국어만 삭제
                </button>
                <button
                  type="button"
                  className="admin-confirm-modal-btn admin-confirm-modal-btn-danger"
                  onClick={() => close("all")}
                >
                  모두 삭제 ({pending.siblingCount + 1}개)
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return { ask, portal: modal };
}
