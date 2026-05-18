"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  SaveStateContext,
  useSaveStateNotifier,
  type SaveStateNotifier,
} from "@/components/admin/sample-blocks/save-state";
import AdminSaveBar from "@/components/admin/AdminSaveBar";
import { setDirtyState } from "@/lib/admin/dirty-store";
import { useDeleteScopeDialog } from "@/lib/admin/useDeleteScopeDialog";
import { createClient } from "@/lib/supabase/client";
import { translateText } from "@/lib/i18n/translate-client";
import type { CommissionCategory, Language, PriceItem } from "@/types/database";

// 수동저장 — 사용자 편집 필드. add/delete/drag 는 즉시 처리(별도 흐름)라 dirty 에 미포함.
const PRICE_EDITABLE_FIELDS = [
  "item_name",
  "price",
  "description",
  "is_approx",
  "main_type",
] as const;

const CATEGORIES: { id: CommissionCategory; label: string }[] = [
  { id: "live2d", label: "Live2D 가격" },
  { id: "illust", label: "Illust 가격" },
];

type Props = {
  initial: PriceItem[];
  locale: Language;
  aiTranslationEnabled: boolean;
};

// 가격 행을 묶어 표시할 그룹 정의 (탭별로 다른 그룹).
type Group = {
  id: string;
  title: string;
  filter: (item: PriceItem) => boolean;
  // 새 항목 INSERT 시 기본값.
  newItemDefaults: () => Pick<
    PriceItem,
    "category" | "is_addon" | "subcategory" | "main_type"
  >;
  // 추가금 그룹은 is_approx 토글 노출.
  showApprox: boolean;
  // Live2D 추가금 그룹만 main_type (illust/rigging) 드롭다운 노출.
  showMainType: boolean;
};

export default function PricingManager({
  initial,
  locale,
  aiTranslationEnabled,
}: Props) {
  const deleteScope = useDeleteScopeDialog();
  const router = useRouter();
  const [activeCategory, setActiveCategory] =
    useState<CommissionCategory>("live2d");
  const [items, setItems] = useState<PriceItem[]>(initial);

  // 자동 저장 인디케이터 — 다른 어드민 페이지와 동일 패턴.
  const [saveState, setSaveState] =
    useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotifier: SaveStateNotifier = useMemo(
    () => ({
      notifySaving: () => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveState("saving");
      },
      notifySaved: () => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveState("saved");
        savedTimerRef.current = setTimeout(() => {
          setSaveState((s) => (s === "saved" ? "idle" : s));
        }, 2000);
      },
      notifyError: () => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveState("error");
      },
    }),
    [],
  );

  useEffect(() => setItems(initial), [initial]);

  // 활성 카테고리에 맞는 그룹 정의.
  const groups: Group[] = useMemo(() => {
    if (activeCategory === "live2d") {
      return [
        {
          id: "live2d-main",
          title: "메인 가격",
          filter: (i) => i.category === "live2d" && !i.is_addon,
          newItemDefaults: () => ({
            category: "live2d",
            is_addon: false,
            subcategory: null,
            main_type: null,
          }),
          showApprox: false,
          showMainType: false,
        },
        {
          id: "live2d-addon",
          title: "추가금 옵션",
          filter: (i) => i.category === "live2d" && i.is_addon,
          newItemDefaults: () => ({
            category: "live2d",
            is_addon: true,
            subcategory: null,
            main_type: "illust",
          }),
          showApprox: true,
          showMainType: true,
        },
      ];
    }
    return [
      {
        id: "illust-broadcast",
        title: "방송용 메인 가격",
        filter: (i) =>
          i.category === "illust" &&
          !i.is_addon &&
          i.subcategory === "broadcast",
        newItemDefaults: () => ({
          category: "illust",
          is_addon: false,
          subcategory: "broadcast",
          main_type: null,
        }),
        showApprox: false,
        showMainType: false,
      },
      {
        id: "illust-commercial",
        title: "상업용 메인 가격",
        filter: (i) =>
          i.category === "illust" &&
          !i.is_addon &&
          i.subcategory === "commercial",
        newItemDefaults: () => ({
          category: "illust",
          is_addon: false,
          subcategory: "commercial",
          main_type: null,
        }),
        showApprox: false,
        showMainType: false,
      },
      {
        id: "illust-addon",
        title: "공통 추가금 옵션",
        filter: (i) => i.category === "illust" && i.is_addon,
        newItemDefaults: () => ({
          category: "illust",
          is_addon: true,
          subcategory: null,
          main_type: null,
        }),
        showApprox: true,
        showMainType: false,
      },
    ];
  }, [activeCategory]);

  // 변경 baseline — 마지막으로 DB 와 동기화된 시점. items 와 비교해 dirty 판단.
  const baselineRef = useRef<Map<string, PriceItem>>(new Map());
  useEffect(() => {
    baselineRef.current = new Map(initial.map((i) => [i.id, i]));
  }, [initial]);

  function updateItemLocal(
    id: string,
    patch: Partial<Omit<PriceItem, "id" | "created_at">>,
  ) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of items) {
      const base = baselineRef.current.get(item.id);
      if (!base) continue; // 새로 add 된 row 는 baseline 에 아직 없음 (즉시 INSERT 됨, 빈 값)
      for (const field of PRICE_EDITABLE_FIELDS) {
        if (item[field] !== base[field]) {
          ids.push(item.id);
          break;
        }
      }
    }
    return ids;
  }, [items]);
  const dirty = dirtyIds.length > 0;

  // 페이지 떠나려고 할 때 dirty 면 브라우저 경고. truthy 문자열 필요 — NoticesManager 주석 참고.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "변경사항이 저장되지 않았어요. 페이지를 떠나시겠어요?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // dirty 상태 + 저장 콜백을 글로벌 store 에 등록 — AdminSidebar navigation guard 용.
  useEffect(() => {
    if (!dirty) {
      setDirtyState(null);
      return;
    }
    setDirtyState({ count: dirtyIds.length, save: handleSaveAll });
    return () => setDirtyState(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, dirtyIds.length]);

  async function handleSaveAll() {
    if (!dirty) return;
    saveNotifier.notifySaving();
    const supabase = createClient();
    const toUpdate = items.filter((i) => dirtyIds.includes(i.id));
    const results = await Promise.all(
      toUpdate.map((it) =>
        supabase
          .from("price_items")
          .update({
            item_name: it.item_name,
            price: it.price,
            description: it.description,
            is_approx: it.is_approx,
            main_type: it.main_type,
          })
          .eq("id", it.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed) {
      console.error("[admin/pricing] save failed:", failed.error?.message);
      saveNotifier.notifyError();
      alert("저장 중 오류가 발생했어요.");
      return;
    }
    saveNotifier.notifySaved();

    // KO 탭 + 글로벌 토글 ON 이면 변경된 row 일괄 번역 다이얼로그.
    // KO 저장이 실패한 경우 도달하지 않음.
    if (locale === "ko" && aiTranslationEnabled && toUpdate.length > 0) {
      await offerBulkTranslation(toUpdate);
    }
    router.refresh();
  }

  // 변경된 price_items 일괄 번역. 다이얼로그 한 번 → "예" → 각 row 별로 sibling 조회
  // 후 텍스트 필드 (item_name, description) 를 EN/JP 로 번역해 update/insert.
  // 가격 숫자 (price), 정렬 (order_num) 같은 비-텍스트는 번역 X — 원본 그대로 복제.
  async function offerBulkTranslation(items: PriceItem[]) {
    const proceed = window.confirm(
      `변경된 항목 ${items.length}개의 영어/일본어 번역본도 만드시겠어요?\n\n` +
        `AI 번역 비용이 발생합니다. (변경된 항목 ${items.length}개)\n\n` +
        `[확인] 예, 번역할게요\n[취소] 아니오, 한국어만`,
    );
    if (!proceed) return;

    saveNotifier.notifySaving();
    const supabase = createClient();
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        // 1) 같은 translation_key 의 en/jp sibling 조회
        const { data: siblings, error: sibErr } = await supabase
          .from("price_items")
          .select("id, language")
          .eq("translation_key", item.translation_key)
          .neq("language", "ko");
        if (sibErr) throw new Error(sibErr.message);
        const existingByLang = new Map<string, string>();
        for (const r of siblings ?? []) existingByLang.set(r.language, r.id);

        // 2) item_name 번역 (필수 — 비어있어도 호출하지 않음)
        let nameTrans: Partial<Record<"en" | "jp", string>> = {};
        if (item.item_name.trim()) {
          const r = await translateText(
            item.item_name,
            ["en", "jp"],
            "가격 항목명",
          );
          nameTrans = r.translations;
        }
        // 3) description 번역 (있을 때만)
        let descTrans: Partial<Record<"en" | "jp", string>> = {};
        if (item.description && item.description.trim()) {
          const r = await translateText(
            item.description,
            ["en", "jp"],
            "가격 항목 설명",
          );
          descTrans = r.translations;
        }

        // 4) upsert
        for (const lang of ["en", "jp"] as const) {
          const item_name = nameTrans[lang] ?? item.item_name;
          const description = descTrans[lang] ?? item.description;
          const existingId = existingByLang.get(lang);
          if (existingId) {
            const { error } = await supabase
              .from("price_items")
              .update({ item_name, description })
              .eq("id", existingId);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await supabase.from("price_items").insert({
              category: item.category,
              item_name,
              price: item.price,
              is_addon: item.is_addon,
              description,
              subcategory: item.subcategory,
              main_type: item.main_type,
              is_approx: item.is_approx,
              order_num: item.order_num,
              language: lang,
              translation_key: item.translation_key,
            });
            if (error) throw new Error(error.message);
          }
        }
        successCount++;
      } catch (e) {
        failCount++;
        const msg = e instanceof Error ? e.message : "unknown error";
        console.error(
          `[admin/pricing] translation failed for ${item.id}:`,
          msg,
        );
      }
    }

    if (failCount > 0) {
      saveNotifier.notifyError();
      alert(`${successCount}개 번역 성공, ${failCount}개 실패.`);
    } else {
      saveNotifier.notifySaved();
      alert(`${successCount}개 번역 완료.`);
    }
  }

  async function addItem(group: Group) {
    saveNotifier.notifySaving();
    const groupItems = items.filter(group.filter);
    const max =
      groupItems.length === 0
        ? -1
        : Math.max(...groupItems.map((i) => i.order_num));

    const supabase = createClient();
    const { data, error } = await supabase
      .from("price_items")
      .insert({
        ...group.newItemDefaults(),
        item_name: "",
        price: 0,
        description: null,
        is_approx: false,
        language: locale,
        translation_key: crypto.randomUUID(),
        order_num: max + 1,
      })
      .select()
      .single();
    // newItemDefaults 가 main_type 을 명시한 그룹 (live2d 추가금) 은 그 값 사용,
    // 그 외 그룹은 컬럼이 DB default (NULL) 로 채워짐. 별도 처리 불필요.

    if (error || !data) {
      console.error("[admin/pricing] add failed:", error?.message);
      saveNotifier.notifyError();
      return;
    }
    setItems((prev) => [...prev, data]);
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function deleteItem(item: PriceItem) {
    const supabase = createClient();
    const scope = await deleteScope.ask({
      supabase,
      table: "price_items",
      translationKey: item.translation_key,
      currentLocale: locale,
      itemHint: item.item_name || undefined,
    });
    if (scope === "cancelled") return;

    saveNotifier.notifySaving();
    // scope === "all": 같은 translation_key 의 모든 언어 row 삭제 (ON DELETE CASCADE 가
    // 자식 테이블 있으면 자동 처리). "current-only": 현재 row 만.
    const query =
      scope === "all"
        ? supabase
            .from("price_items")
            .delete()
            .eq("translation_key", item.translation_key)
        : supabase.from("price_items").delete().eq("id", item.id);
    const { error } = await query;
    if (error) {
      console.error("[admin/pricing] delete failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    // 로컬 state 청소 — scope=all 이어도 이 페이지의 items 는 현재 locale 만 들고 있어
    // 결과적으로 1개 row 만 제거하면 됨.
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    saveNotifier.notifySaved();
    router.refresh();
  }

  // persistItem 제거 — 수동저장으로 전환. updateItemLocal + handleSaveAll 로 대체.

  // 그룹 단위 정렬 (드래그 종료 시 그룹 안 항목들의 order_num 재계산).
  async function handleDragEnd(group: Group, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const groupItems = items
      .filter(group.filter)
      .sort((a, b) => a.order_num - b.order_num);
    const oldIndex = groupItems.findIndex((i) => i.id === active.id);
    const newIndex = groupItems.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(groupItems, oldIndex, newIndex);
    const updates = reordered.map((i, idx) => ({ id: i.id, order_num: idx }));

    setItems((prev) =>
      prev.map((i) => {
        const u = updates.find((x) => x.id === i.id);
        return u ? { ...i, order_num: u.order_num } : i;
      }),
    );

    saveNotifier.notifySaving();
    const supabase = createClient();
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("price_items")
          .update({ order_num: u.order_num })
          .eq("id", u.id),
      ),
    );
    if (results.some((r) => r.error)) saveNotifier.notifyError();
    else saveNotifier.notifySaved();
    router.refresh();
  }

  return (
    <SaveStateContext.Provider value={saveNotifier}>
      <div className="admin-main-card">
        <div className="admin-notices-toolbar">
          <div>
            <h1 className="admin-main-title">가격 관리</h1>
            <p className="admin-notices-sub">
              Live2D / Illust 페이지에 표시되는 가격 정보를 관리할 수 있어요
            </p>
          </div>
          <div
            className={`admin-samples-save-indicator admin-samples-save-${saveState}`}
            aria-live="polite"
          >
            {saveState === "saving" && "저장 중..."}
            {saveState === "saved" && "✓ 저장됨"}
            {saveState === "error" && "저장 실패"}
            {/* dirty 인디케이터는 하단 AdminSaveBar 로 이동 */}
          </div>
        </div>

        <div className="admin-samples-tabs" role="tablist">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat.id}
              className={`admin-samples-tab${activeCategory === cat.id ? " admin-samples-tab-active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 그룹별로 빈 상태는 PricingGroup 내부의 "항목이 없어요" 메시지 + 추가 버튼이 처리.
            EN/JP 탭에서도 동일 — 어드민이 "+ 항목 추가" 로 수동 입력. */}
        <div className="admin-pricing-groups">
          {groups.map((group) => {
            const groupItems = items
              .filter(group.filter)
              .sort((a, b) => a.order_num - b.order_num);

            return (
              <PricingGroup
                key={group.id}
                group={group}
                items={groupItems}
                onAdd={() => addItem(group)}
                onDelete={(item) => deleteItem(item)}
                onUpdateLocal={updateItemLocal}
                onDragEnd={(e) => handleDragEnd(group, e)}
              />
            );
          })}
        </div>

      </div>
      <AdminSaveBar dirtyCount={dirtyIds.length} onSave={handleSaveAll} />
      {deleteScope.portal}
    </SaveStateContext.Provider>
  );
}

function PricingGroup({
  group,
  items,
  onAdd,
  onDelete,
  onUpdateLocal,
  onDragEnd,
}: {
  group: Group;
  items: PriceItem[];
  onAdd: () => void;
  onDelete: (item: PriceItem) => void;
  onUpdateLocal: (
    id: string,
    patch: Partial<Omit<PriceItem, "id" | "created_at">>,
  ) => void;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <section className="admin-pricing-group">
      <h2 className="admin-pricing-group-title">{group.title}</h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="admin-pricing-rows">
            {items.length === 0 && (
              <p className="admin-pricing-empty">
                항목이 없어요. 아래 버튼으로 추가해 주세요.
              </p>
            )}
            {items.map((item) => (
              <PricingRow
                key={item.id}
                item={item}
                showApprox={group.showApprox}
                showMainType={group.showMainType}
                onUpdateLocal={(patch) => onUpdateLocal(item.id, patch)}
                onDelete={() => onDelete(item)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        className="admin-pricing-add-btn"
        onClick={onAdd}
      >
        + {group.title} 항목 추가
      </button>
    </section>
  );
}

function PricingRow({
  item,
  showApprox,
  showMainType,
  onUpdateLocal,
  onDelete,
}: {
  item: PriceItem;
  showApprox: boolean;
  showMainType: boolean;
  onUpdateLocal: (
    patch: Partial<Omit<PriceItem, "id" | "created_at">>,
  ) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="admin-pricing-row">
      <button
        type="button"
        className="admin-pricing-handle"
        aria-label="순서 드래그"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <input
        type="text"
        className="admin-form-input admin-pricing-name"
        value={item.item_name}
        placeholder="항목 이름"
        onChange={(e) => onUpdateLocal({ item_name: e.target.value })}
      />

      <input
        type="number"
        className="admin-form-input admin-pricing-price"
        value={item.price}
        placeholder="0"
        min={0}
        step={1000}
        onChange={(e) => onUpdateLocal({ price: Number(e.target.value) || 0 })}
      />

      {showApprox && (
        <label className="admin-pricing-approx" title="약 (~)">
          <input
            type="checkbox"
            checked={item.is_approx}
            onChange={(e) => onUpdateLocal({ is_approx: e.target.checked })}
          />
          ~
        </label>
      )}

      <input
        type="text"
        className="admin-form-input admin-pricing-desc"
        value={item.description ?? ""}
        placeholder="설명 (선택)"
        onChange={(e) => onUpdateLocal({ description: e.target.value })}
      />

      {showMainType && (
        // Live2D 추가금에만 노출. 'illust' / 'rigging' / 공통(null) 중 선택.
        <select
          className="admin-form-input admin-pricing-maintype"
          value={item.main_type ?? ""}
          aria-label="메인 타입"
          onChange={(e) => {
            const v = e.target.value;
            onUpdateLocal({
              main_type: v === "" ? null : (v as "illust" | "rigging"),
            });
          }}
        >
          <option value="">공통</option>
          <option value="illust">Illustration type</option>
          <option value="rigging">Illustration + rigging type</option>
        </select>
      )}

      <button
        type="button"
        className="admin-block-delete"
        onClick={onDelete}
        aria-label="항목 삭제"
      >
        ✕
      </button>
    </div>
  );
}
