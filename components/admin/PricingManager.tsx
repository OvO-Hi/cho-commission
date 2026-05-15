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
import { createClient } from "@/lib/supabase/client";
import type { CommissionCategory, PriceItem } from "@/types/database";

const SAVE_DEBOUNCE_MS = 500;

const CATEGORIES: { id: CommissionCategory; label: string }[] = [
  { id: "live2d", label: "Live2D 가격" },
  { id: "illust", label: "Illust 가격" },
];

type Props = {
  initial: PriceItem[];
};

// 가격 행을 묶어 표시할 그룹 정의 (탭별로 다른 그룹).
type Group = {
  id: string;
  title: string;
  filter: (item: PriceItem) => boolean;
  // 새 항목 INSERT 시 기본값.
  newItemDefaults: () => Pick<
    PriceItem,
    "category" | "is_addon" | "subcategory"
  >;
  // 추가금 그룹은 is_approx 토글 노출.
  showApprox: boolean;
};

export default function PricingManager({ initial }: Props) {
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
          }),
          showApprox: false,
        },
        {
          id: "live2d-addon",
          title: "추가금 옵션",
          filter: (i) => i.category === "live2d" && i.is_addon,
          newItemDefaults: () => ({
            category: "live2d",
            is_addon: true,
            subcategory: null,
          }),
          showApprox: true,
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
        }),
        showApprox: false,
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
        }),
        showApprox: false,
      },
      {
        id: "illust-addon",
        title: "공통 추가금 옵션",
        filter: (i) => i.category === "illust" && i.is_addon,
        newItemDefaults: () => ({
          category: "illust",
          is_addon: true,
          subcategory: null,
        }),
        showApprox: true,
      },
    ];
  }, [activeCategory]);

  function updateItemLocal(
    id: string,
    patch: Partial<Omit<PriceItem, "id" | "created_at">>,
  ) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
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
        language: "ko",
        order_num: max + 1,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[admin/pricing] add failed:", error?.message);
      saveNotifier.notifyError();
      return;
    }
    setItems((prev) => [...prev, data]);
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function deleteItem(id: string) {
    saveNotifier.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("price_items")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("[admin/pricing] delete failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function persistItem(
    id: string,
    patch: Partial<Omit<PriceItem, "id" | "created_at">>,
  ) {
    saveNotifier.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("price_items")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[admin/pricing] update failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    saveNotifier.notifySaved();
    router.refresh();
  }

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
                onDelete={deleteItem}
                onUpdateLocal={updateItemLocal}
                onPersist={persistItem}
                onDragEnd={(e) => handleDragEnd(group, e)}
              />
            );
          })}
        </div>
      </div>
    </SaveStateContext.Provider>
  );
}

function PricingGroup({
  group,
  items,
  onAdd,
  onDelete,
  onUpdateLocal,
  onPersist,
  onDragEnd,
}: {
  group: Group;
  items: PriceItem[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdateLocal: (
    id: string,
    patch: Partial<Omit<PriceItem, "id" | "created_at">>,
  ) => void;
  onPersist: (
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
                onUpdateLocal={(patch) => onUpdateLocal(item.id, patch)}
                onPersist={(patch) => onPersist(item.id, patch)}
                onDelete={() => onDelete(item.id)}
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
  onUpdateLocal,
  onPersist,
  onDelete,
}: {
  item: PriceItem;
  showApprox: boolean;
  onUpdateLocal: (
    patch: Partial<Omit<PriceItem, "id" | "created_at">>,
  ) => void;
  onPersist: (patch: Partial<Omit<PriceItem, "id" | "created_at">>) => void;
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 텍스트/숫자 입력은 디바운스 후 저장.
  function scheduleTextSave(patch: Partial<PriceItem>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onPersist(patch);
    }, SAVE_DEBOUNCE_MS);
  }

  function flushPending(patch: Partial<PriceItem>) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      onPersist(patch);
    }
  }

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
        onChange={(e) => {
          const v = e.target.value;
          onUpdateLocal({ item_name: v });
          scheduleTextSave({ item_name: v });
        }}
        onBlur={() => flushPending({ item_name: item.item_name })}
      />

      <input
        type="number"
        className="admin-form-input admin-pricing-price"
        value={item.price}
        placeholder="0"
        min={0}
        step={1000}
        onChange={(e) => {
          const v = Number(e.target.value) || 0;
          onUpdateLocal({ price: v });
          scheduleTextSave({ price: v });
        }}
        onBlur={() => flushPending({ price: item.price })}
      />

      {showApprox && (
        <label className="admin-pricing-approx" title="약 (~)">
          <input
            type="checkbox"
            checked={item.is_approx}
            onChange={(e) => onPersist({ is_approx: e.target.checked })}
          />
          ~
        </label>
      )}

      <input
        type="text"
        className="admin-form-input admin-pricing-desc"
        value={item.description ?? ""}
        placeholder="설명 (선택)"
        onChange={(e) => {
          const v = e.target.value;
          onUpdateLocal({ description: v });
          scheduleTextSave({ description: v });
        }}
        onBlur={() =>
          flushPending({ description: item.description ?? "" })
        }
      />

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
