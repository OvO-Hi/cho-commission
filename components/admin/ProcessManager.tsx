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

import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  SaveStateContext,
  type SaveStateNotifier,
} from "@/components/admin/sample-blocks/save-state";
import { createClient } from "@/lib/supabase/client";
import type {
  CommissionCategory,
  Live2DType,
  Live2DTypeItem,
  ProcessStep,
} from "@/types/database";

const SAVE_DEBOUNCE_MS = 500;

const CATEGORIES: { id: CommissionCategory; label: string }[] = [
  { id: "live2d", label: "Live2D" },
  { id: "illust", label: "Illust" },
];

type Props = {
  initialSteps: ProcessStep[];
  initialTypes: Live2DType[];
  initialTypeItems: Live2DTypeItem[];
};

export default function ProcessManager({
  initialSteps,
  initialTypes,
  initialTypeItems,
}: Props) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] =
    useState<CommissionCategory>("live2d");
  const [steps, setSteps] = useState<ProcessStep[]>(initialSteps);
  const [types, setTypes] = useState<Live2DType[]>(initialTypes);
  const [typeItems, setTypeItems] =
    useState<Live2DTypeItem[]>(initialTypeItems);

  // 자동 저장 인디케이터
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

  useEffect(() => setSteps(initialSteps), [initialSteps]);
  useEffect(() => setTypes(initialTypes), [initialTypes]);
  useEffect(() => setTypeItems(initialTypeItems), [initialTypeItems]);

  const visibleSteps = useMemo(
    () =>
      steps
        .filter((s) => s.category === activeCategory)
        .sort((a, b) => a.step_num - b.step_num),
    [steps, activeCategory],
  );

  // ─────────── ProcessSteps mutations ───────────
  async function addStep() {
    saveNotifier.notifySaving();
    const max =
      visibleSteps.length === 0
        ? 0
        : Math.max(...visibleSteps.map((s) => s.step_num));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("process_steps")
      .insert({
        category: activeCategory,
        step_num: max + 1,
        title: "",
        description: null,
        language: "ko",
      })
      .select()
      .single();
    if (error || !data) {
      console.error("[admin/process] add step failed:", error?.message);
      saveNotifier.notifyError();
      return;
    }
    setSteps((prev) => [...prev, data]);
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function deleteStep(id: string) {
    saveNotifier.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("process_steps")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("[admin/process] delete step failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    setSteps((prev) => prev.filter((s) => s.id !== id));
    saveNotifier.notifySaved();
    router.refresh();
  }

  function updateStepLocal(id: string, patch: Partial<ProcessStep>) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  async function persistStep(
    id: string,
    patch: Partial<Omit<ProcessStep, "id" | "created_at">>,
  ) {
    saveNotifier.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("process_steps")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[admin/process] update step failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function handleStepsDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleSteps.findIndex((s) => s.id === active.id);
    const newIndex = visibleSteps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(visibleSteps, oldIndex, newIndex);
    const updates = reordered.map((s, i) => ({ id: s.id, step_num: i + 1 }));
    setSteps((prev) =>
      prev.map((s) => {
        const u = updates.find((x) => x.id === s.id);
        return u ? { ...s, step_num: u.step_num } : s;
      }),
    );

    saveNotifier.notifySaving();
    const supabase = createClient();
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("process_steps")
          .update({ step_num: u.step_num })
          .eq("id", u.id),
      ),
    );
    if (results.some((r) => r.error)) saveNotifier.notifyError();
    else saveNotifier.notifySaved();
    router.refresh();
  }

  // ─────────── Live2DTypes mutations ───────────
  async function addType() {
    saveNotifier.notifySaving();
    const max =
      types.length === 0 ? -1 : Math.max(...types.map((t) => t.order_num));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("live2d_types")
      .insert({
        type_key: "",
        title: "",
        order_num: max + 1,
        language: "ko",
      })
      .select()
      .single();
    if (error || !data) {
      console.error("[admin/process] add type failed:", error?.message);
      saveNotifier.notifyError();
      return;
    }
    setTypes((prev) => [...prev, data]);
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function deleteType(id: string) {
    saveNotifier.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("live2d_types")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("[admin/process] delete type failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    setTypes((prev) => prev.filter((t) => t.id !== id));
    saveNotifier.notifySaved();
    router.refresh();
  }

  function updateTypeLocal(id: string, patch: Partial<Live2DType>) {
    setTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }

  async function persistType(
    id: string,
    patch: Partial<Omit<Live2DType, "id" | "created_at">>,
  ) {
    saveNotifier.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("live2d_types")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[admin/process] update type failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    saveNotifier.notifySaved();
    router.refresh();
  }

  // ─────────── Live2DTypeItems mutations (각 타입 카드의 자식 항목들) ───────────
  async function addTypeItem(typeId: string) {
    saveNotifier.notifySaving();
    const siblings = typeItems.filter((i) => i.type_id === typeId);
    const max =
      siblings.length === 0
        ? -1
        : Math.max(...siblings.map((i) => i.order_num));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("live2d_type_items")
      .insert({
        type_id: typeId,
        label: null,
        value: "",
        order_num: max + 1,
      })
      .select()
      .single();
    if (error || !data) {
      console.error("[admin/process] add type item failed:", error?.message);
      saveNotifier.notifyError();
      return;
    }
    setTypeItems((prev) => [...prev, data]);
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function deleteTypeItem(id: string) {
    saveNotifier.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("live2d_type_items")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("[admin/process] delete type item failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    setTypeItems((prev) => prev.filter((i) => i.id !== id));
    saveNotifier.notifySaved();
    router.refresh();
  }

  function updateTypeItemLocal(id: string, patch: Partial<Live2DTypeItem>) {
    setTypeItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }

  async function persistTypeItem(
    id: string,
    patch: Partial<Omit<Live2DTypeItem, "id" | "created_at">>,
  ) {
    saveNotifier.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("live2d_type_items")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[admin/process] update type item failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function handleTypeItemsDragEnd(typeId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const siblings = typeItems
      .filter((i) => i.type_id === typeId)
      .sort((a, b) => a.order_num - b.order_num);
    const oldIndex = siblings.findIndex((i) => i.id === active.id);
    const newIndex = siblings.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(siblings, oldIndex, newIndex);
    const updates = reordered.map((i, idx) => ({ id: i.id, order_num: idx }));
    setTypeItems((prev) =>
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
          .from("live2d_type_items")
          .update({ order_num: u.order_num })
          .eq("id", u.id),
      ),
    );
    if (results.some((r) => r.error)) saveNotifier.notifyError();
    else saveNotifier.notifySaved();
    router.refresh();
  }

  async function handleTypesDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sorted = [...types].sort((a, b) => a.order_num - b.order_num);
    const oldIndex = sorted.findIndex((t) => t.id === active.id);
    const newIndex = sorted.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    const updates = reordered.map((t, i) => ({ id: t.id, order_num: i }));
    setTypes((prev) =>
      prev.map((t) => {
        const u = updates.find((x) => x.id === t.id);
        return u ? { ...t, order_num: u.order_num } : t;
      }),
    );
    saveNotifier.notifySaving();
    const supabase = createClient();
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("live2d_types")
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
            <h1 className="admin-main-title">작업 과정 관리</h1>
            <p className="admin-notices-sub">
              사용자 페이지의 작업 과정 단계와 Live2D 타입 카드를 관리할 수 있어요
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

        <ProcessStepsSection
          steps={visibleSteps}
          onAdd={addStep}
          onDelete={deleteStep}
          onUpdateLocal={updateStepLocal}
          onPersist={persistStep}
          onDragEnd={handleStepsDragEnd}
        />

        {activeCategory === "live2d" && (
          <Live2DTypesSection
            types={[...types].sort((a, b) => a.order_num - b.order_num)}
            typeItems={typeItems}
            onAdd={addType}
            onDelete={deleteType}
            onUpdateLocal={updateTypeLocal}
            onPersist={persistType}
            onDragEnd={handleTypesDragEnd}
            onAddItem={addTypeItem}
            onDeleteItem={deleteTypeItem}
            onUpdateItemLocal={updateTypeItemLocal}
            onPersistItem={persistTypeItem}
            onItemsDragEnd={handleTypeItemsDragEnd}
          />
        )}
      </div>
    </SaveStateContext.Provider>
  );
}

// ─────────────── ProcessSteps section ───────────────
function ProcessStepsSection({
  steps,
  onAdd,
  onDelete,
  onUpdateLocal,
  onPersist,
  onDragEnd,
}: {
  steps: ProcessStep[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdateLocal: (id: string, patch: Partial<ProcessStep>) => void;
  onPersist: (
    id: string,
    patch: Partial<Omit<ProcessStep, "id" | "created_at">>,
  ) => void;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <section className="admin-process-section">
      <h2 className="admin-process-section-title">작업 단계</h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={steps.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="admin-process-rows">
            {steps.length === 0 && (
              <p className="admin-process-empty">
                단계가 없어요. 아래 버튼으로 첫 단계를 추가해 보세요.
              </p>
            )}
            {steps.map((step, idx) => (
              <ProcessStepRow
                key={step.id}
                step={step}
                stepIndex={idx + 1}
                onDelete={() => onDelete(step.id)}
                onUpdateLocal={(patch) => onUpdateLocal(step.id, patch)}
                onPersist={(patch) => onPersist(step.id, patch)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button type="button" className="admin-pricing-add-btn" onClick={onAdd}>
        + 단계 추가
      </button>
    </section>
  );
}

function ProcessStepRow({
  step,
  stepIndex,
  onDelete,
  onUpdateLocal,
  onPersist,
}: {
  step: ProcessStep;
  stepIndex: number;
  onDelete: () => void;
  onUpdateLocal: (patch: Partial<ProcessStep>) => void;
  onPersist: (
    patch: Partial<Omit<ProcessStep, "id" | "created_at">>,
  ) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  // 디폴트: description 이 있으면 펼침. 없으면 접힘.
  const [showDesc, setShowDesc] = useState<boolean>(
    !!step.description?.trim(),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleTitleSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onPersist({ title: next });
    }, SAVE_DEBOUNCE_MS);
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="admin-process-row">
      <button
        type="button"
        className="admin-pricing-handle"
        aria-label="순서 드래그"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <span className="admin-process-num">
        {String(stepIndex).padStart(2, "0")}
      </span>

      <input
        type="text"
        className="admin-form-input admin-process-title"
        value={step.title}
        placeholder="단계 제목"
        onChange={(e) => {
          onUpdateLocal({ title: e.target.value });
          scheduleTitleSave(e.target.value);
        }}
        onBlur={() => {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
            onPersist({ title: step.title });
          }
        }}
      />

      <button
        type="button"
        className="admin-process-toggle"
        onClick={() => setShowDesc((v) => !v)}
      >
        {showDesc ? "− 상세 설명 숨기기" : "+ 상세 설명 추가"}
      </button>

      <button
        type="button"
        className="admin-block-delete"
        onClick={onDelete}
        aria-label="단계 삭제"
      >
        ✕
      </button>

      {showDesc && (
        <div className="admin-process-desc">
          <RichTextEditor
            value={step.description ?? ""}
            onSave={async (html) => {
              const supabase = createClient();
              const { error } = await supabase
                .from("process_steps")
                .update({ description: html })
                .eq("id", step.id);
              if (error) throw new Error(error.message);
              onUpdateLocal({ description: html });
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────── Live2DTypes section ───────────────
function Live2DTypesSection({
  types,
  typeItems,
  onAdd,
  onDelete,
  onUpdateLocal,
  onPersist,
  onDragEnd,
  onAddItem,
  onDeleteItem,
  onUpdateItemLocal,
  onPersistItem,
  onItemsDragEnd,
}: {
  types: Live2DType[];
  typeItems: Live2DTypeItem[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdateLocal: (id: string, patch: Partial<Live2DType>) => void;
  onPersist: (
    id: string,
    patch: Partial<Omit<Live2DType, "id" | "created_at">>,
  ) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onAddItem: (typeId: string) => void;
  onDeleteItem: (id: string) => void;
  onUpdateItemLocal: (id: string, patch: Partial<Live2DTypeItem>) => void;
  onPersistItem: (
    id: string,
    patch: Partial<Omit<Live2DTypeItem, "id" | "created_at">>,
  ) => void;
  onItemsDragEnd: (typeId: string, event: DragEndEvent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <section className="admin-process-section">
      <h2 className="admin-process-section-title">타입 카드 관리</h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={types.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="admin-process-rows">
            {types.length === 0 && (
              <p className="admin-process-empty">
                타입 카드가 없어요. 아래 버튼으로 추가해 주세요.
              </p>
            )}
            {types.map((type) => {
              const items = typeItems
                .filter((i) => i.type_id === type.id)
                .sort((a, b) => a.order_num - b.order_num);
              return (
                <Live2DTypeRow
                  key={type.id}
                  type={type}
                  items={items}
                  onDelete={() => onDelete(type.id)}
                  onUpdateLocal={(patch) => onUpdateLocal(type.id, patch)}
                  onPersist={(patch) => onPersist(type.id, patch)}
                  onAddItem={() => onAddItem(type.id)}
                  onDeleteItem={onDeleteItem}
                  onUpdateItemLocal={onUpdateItemLocal}
                  onPersistItem={onPersistItem}
                  onItemsDragEnd={(e) => onItemsDragEnd(type.id, e)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <button type="button" className="admin-pricing-add-btn" onClick={onAdd}>
        + 타입 카드 추가
      </button>
    </section>
  );
}

function Live2DTypeRow({
  type,
  items,
  onDelete,
  onUpdateLocal,
  onPersist,
  onAddItem,
  onDeleteItem,
  onUpdateItemLocal,
  onPersistItem,
  onItemsDragEnd,
}: {
  type: Live2DType;
  items: Live2DTypeItem[];
  onDelete: () => void;
  onUpdateLocal: (patch: Partial<Live2DType>) => void;
  onPersist: (
    patch: Partial<Omit<Live2DType, "id" | "created_at">>,
  ) => void;
  onAddItem: () => void;
  onDeleteItem: (id: string) => void;
  onUpdateItemLocal: (id: string, patch: Partial<Live2DTypeItem>) => void;
  onPersistItem: (
    id: string,
    patch: Partial<Omit<Live2DTypeItem, "id" | "created_at">>,
  ) => void;
  onItemsDragEnd: (event: DragEndEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type.id });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 항목 dnd 용 별도 sensor — 타입 카드 dnd 와는 별개의 컨텍스트.
  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function scheduleSave(patch: Partial<Live2DType>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onPersist(patch);
    }, SAVE_DEBOUNCE_MS);
  }

  function flush(patch: Partial<Live2DType>) {
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
    <div ref={setNodeRef} style={style} className="admin-type-row">
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
        className="admin-form-input admin-type-key"
        value={type.type_key}
        placeholder="key (예: illust)"
        onChange={(e) => {
          onUpdateLocal({ type_key: e.target.value });
          scheduleSave({ type_key: e.target.value });
        }}
        onBlur={() => flush({ type_key: type.type_key })}
      />

      <input
        type="text"
        className="admin-form-input admin-type-title"
        value={type.title}
        placeholder="카드 제목"
        onChange={(e) => {
          onUpdateLocal({ title: e.target.value });
          scheduleSave({ title: e.target.value });
        }}
        onBlur={() => flush({ title: type.title })}
      />

      <button
        type="button"
        className="admin-block-delete"
        onClick={onDelete}
        aria-label="타입 카드 삭제"
      >
        ✕
      </button>

      {/* 카드 본문: 자식 항목 리스트 (label / value) */}
      <div className="admin-type-desc">
        <DndContext
          sensors={itemSensors}
          collisionDetection={closestCenter}
          onDragEnd={onItemsDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="admin-type-items-list">
              {items.length === 0 && (
                <p className="admin-type-items-empty">
                  항목이 없어요. 아래 버튼으로 추가해 주세요.
                </p>
              )}
              {items.map((item) => (
                <Live2DTypeItemRow
                  key={item.id}
                  item={item}
                  onDelete={() => onDeleteItem(item.id)}
                  onUpdateLocal={(patch) => onUpdateItemLocal(item.id, patch)}
                  onPersist={(patch) => onPersistItem(item.id, patch)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button
          type="button"
          className="admin-type-add-item"
          onClick={onAddItem}
        >
          + 항목 추가
        </button>
      </div>
    </div>
  );
}

function Live2DTypeItemRow({
  item,
  onDelete,
  onUpdateLocal,
  onPersist,
}: {
  item: Live2DTypeItem;
  onDelete: () => void;
  onUpdateLocal: (patch: Partial<Live2DTypeItem>) => void;
  onPersist: (
    patch: Partial<Omit<Live2DTypeItem, "id" | "created_at">>,
  ) => void;
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

  function scheduleSave(patch: Partial<Live2DTypeItem>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onPersist(patch);
    }, SAVE_DEBOUNCE_MS);
  }

  function flush(patch: Partial<Live2DTypeItem>) {
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
    <div ref={setNodeRef} style={style} className="admin-type-item-row">
      <button
        type="button"
        className="admin-pricing-handle"
        aria-label="항목 드래그"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <input
        type="text"
        className="admin-form-input admin-type-item-input"
        value={item.label ?? ""}
        placeholder="라벨 (선택)"
        onChange={(e) => {
          // 빈 문자열이면 null 로 저장 → 사용자 페이지에서 "·" 로 표시.
          const next = e.target.value;
          onUpdateLocal({ label: next });
          scheduleSave({ label: next.length === 0 ? null : next });
        }}
        onBlur={() =>
          flush({
            label: item.label && item.label.length > 0 ? item.label : null,
          })
        }
      />

      <input
        type="text"
        className="admin-form-input admin-type-item-input"
        value={item.value}
        placeholder="값"
        onChange={(e) => {
          onUpdateLocal({ value: e.target.value });
          scheduleSave({ value: e.target.value });
        }}
        onBlur={() => flush({ value: item.value })}
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
