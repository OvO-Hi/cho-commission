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

import AdminSaveBar from "@/components/admin/AdminSaveBar";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  SaveStateContext,
  type SaveStateNotifier,
} from "@/components/admin/sample-blocks/save-state";
import { setDirtyState } from "@/lib/admin/dirty-store";
import { useDeleteScopeDialog } from "@/lib/admin/useDeleteScopeDialog";
import { createClient } from "@/lib/supabase/client";
import { translateText } from "@/lib/i18n/translate-client";
import type {
  CommissionCategory,
  Language,
  Live2DType,
  Live2DTypeItem,
  ProcessStep,
} from "@/types/database";

// 수동저장 — 사용자 편집 필드. 모듈 상수라 useMemo 의 deps 안정성 보장.
const STEP_FIELDS = ["title", "description"] as const;
const TYPE_FIELDS = ["type_key", "title"] as const;
const TYPE_ITEM_FIELDS = ["label", "value"] as const;

const CATEGORIES: { id: CommissionCategory; label: string }[] = [
  { id: "live2d", label: "Live2D" },
  { id: "illust", label: "Illust" },
];

type Props = {
  initialSteps: ProcessStep[];
  initialTypes: Live2DType[];
  initialTypeItems: Live2DTypeItem[];
  locale: Language;
  aiTranslationEnabled: boolean;
};

export default function ProcessManager({
  initialSteps,
  initialTypes,
  initialTypeItems,
  locale,
  aiTranslationEnabled,
}: Props) {
  const deleteScope = useDeleteScopeDialog();
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

  // ─── dirty 추적 (수동저장) ───
  // 사용자가 row 입력값을 바꾸면 로컬 state 만 업데이트하고, 저장 버튼 클릭 시
  // baseline 과 diff 해서 변경된 row 만 일괄 UPDATE 한다. add/delete/drag 는 즉시 DB.
  const stepBaseRef = useRef<Map<string, ProcessStep>>(new Map());
  const typeBaseRef = useRef<Map<string, Live2DType>>(new Map());
  const typeItemBaseRef = useRef<Map<string, Live2DTypeItem>>(new Map());
  useEffect(() => {
    stepBaseRef.current = new Map(initialSteps.map((s) => [s.id, s]));
  }, [initialSteps]);
  useEffect(() => {
    typeBaseRef.current = new Map(initialTypes.map((t) => [t.id, t]));
  }, [initialTypes]);
  useEffect(() => {
    typeItemBaseRef.current = new Map(initialTypeItems.map((i) => [i.id, i]));
  }, [initialTypeItems]);

  const dirtyStepIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of steps) {
      const base = stepBaseRef.current.get(s.id);
      if (!base) continue;
      if (STEP_FIELDS.some((f) => s[f] !== base[f])) ids.push(s.id);
    }
    return ids;
  }, [steps]);
  const dirtyTypeIds = useMemo(() => {
    const ids: string[] = [];
    for (const t of types) {
      const base = typeBaseRef.current.get(t.id);
      if (!base) continue;
      if (TYPE_FIELDS.some((f) => t[f] !== base[f])) ids.push(t.id);
    }
    return ids;
  }, [types]);
  const dirtyTypeItemIds = useMemo(() => {
    const ids: string[] = [];
    for (const it of typeItems) {
      const base = typeItemBaseRef.current.get(it.id);
      if (!base) continue;
      if (TYPE_ITEM_FIELDS.some((f) => it[f] !== base[f])) ids.push(it.id);
    }
    return ids;
  }, [typeItems]);

  const dirtyCount =
    dirtyStepIds.length + dirtyTypeIds.length + dirtyTypeItemIds.length;
  const dirty = dirtyCount > 0;

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
    setDirtyState({ count: dirtyCount, save: handleSaveAll });
    return () => setDirtyState(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, dirtyCount]);

  async function handleSaveAll() {
    if (!dirty) return;
    saveNotifier.notifySaving();
    const supabase = createClient();

    const stepUpdates = steps
      .filter((s) => dirtyStepIds.includes(s.id))
      .map((s) =>
        supabase
          .from("process_steps")
          .update({ title: s.title, description: s.description })
          .eq("id", s.id),
      );
    const typeUpdates = types
      .filter((t) => dirtyTypeIds.includes(t.id))
      .map((t) =>
        supabase
          .from("live2d_types")
          .update({ type_key: t.type_key, title: t.title })
          .eq("id", t.id),
      );
    const itemUpdates = typeItems
      .filter((it) => dirtyTypeItemIds.includes(it.id))
      .map((it) =>
        supabase
          .from("live2d_type_items")
          .update({ label: it.label, value: it.value })
          .eq("id", it.id),
      );

    const results = await Promise.all([
      ...stepUpdates,
      ...typeUpdates,
      ...itemUpdates,
    ]);
    const failed = results.find((r) => r.error);
    if (failed) {
      console.error("[admin/process] save failed:", failed.error?.message);
      saveNotifier.notifyError();
      alert("저장 중 오류가 발생했어요.");
      return;
    }
    saveNotifier.notifySaved();

    // KO 탭 + 글로벌 토글 ON 이면 변경된 row 일괄 번역 다이얼로그.
    // live2d_type_items 는 부모(live2d_types) 종속이라 번역 매핑이 까다로움 — 이번 PR
    // 에서는 process_steps + live2d_types 만 처리. type_items 번역은 후속 PR.
    if (locale === "ko" && aiTranslationEnabled) {
      const dirtySteps = steps.filter((s) => dirtyStepIds.includes(s.id));
      const dirtyTypes = types.filter((t) => dirtyTypeIds.includes(t.id));
      const totalTranslatable = dirtySteps.length + dirtyTypes.length;
      if (totalTranslatable > 0) {
        await offerBulkTranslation(dirtySteps, dirtyTypes);
      }
    }
    router.refresh();
  }

  // process_steps + live2d_types 변경분 일괄 번역.
  // 비-텍스트 필드 (step_num, order_num, type_key) 는 번역 X — 원본 그대로 복제.
  // type_key 는 영문 식별자라 의도적 제외.
  async function offerBulkTranslation(
    dirtySteps: ProcessStep[],
    dirtyTypes: Live2DType[],
  ) {
    const total = dirtySteps.length + dirtyTypes.length;
    const proceed = window.confirm(
      `변경된 항목 ${total}개의 영어/일본어 번역본도 만드시겠어요?\n\n` +
        `AI 번역 비용이 발생합니다. (변경된 항목 ${total}개)\n\n` +
        `[확인] 예, 번역할게요\n[취소] 아니오, 한국어만`,
    );
    if (!proceed) return;

    saveNotifier.notifySaving();
    const supabase = createClient();
    let successCount = 0;
    let failCount = 0;

    // process_steps 처리
    for (const step of dirtySteps) {
      try {
        const { data: siblings, error: sibErr } = await supabase
          .from("process_steps")
          .select("id, language")
          .eq("translation_key", step.translation_key)
          .neq("language", "ko");
        if (sibErr) throw new Error(sibErr.message);
        const existingByLang = new Map<string, string>();
        for (const r of siblings ?? []) existingByLang.set(r.language, r.id);

        let titleTrans: Partial<Record<"en" | "jp", string>> = {};
        if (step.title.trim()) {
          const r = await translateText(step.title, ["en", "jp"], "작업 과정 단계 제목");
          titleTrans = r.translations;
        }
        let descTrans: Partial<Record<"en" | "jp", string>> = {};
        if (step.description && step.description.trim()) {
          const r = await translateText(
            step.description,
            ["en", "jp"],
            "작업 과정 단계 설명 (HTML 가능)",
          );
          descTrans = r.translations;
        }

        for (const lang of ["en", "jp"] as const) {
          const title = titleTrans[lang] ?? step.title;
          const description = descTrans[lang] ?? step.description;
          const existingId = existingByLang.get(lang);
          if (existingId) {
            const { error } = await supabase
              .from("process_steps")
              .update({ title, description })
              .eq("id", existingId);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await supabase.from("process_steps").insert({
              category: step.category,
              step_num: step.step_num,
              title,
              description,
              language: lang,
              translation_key: step.translation_key,
            });
            if (error) throw new Error(error.message);
          }
        }
        successCount++;
      } catch (e) {
        failCount++;
        const msg = e instanceof Error ? e.message : "unknown error";
        console.error(`[admin/process] translation failed for step ${step.id}:`, msg);
      }
    }

    // live2d_types 처리 — title 만 번역 (type_key 는 영문 식별자라 제외)
    for (const type of dirtyTypes) {
      try {
        const { data: siblings, error: sibErr } = await supabase
          .from("live2d_types")
          .select("id, language")
          .eq("translation_key", type.translation_key)
          .neq("language", "ko");
        if (sibErr) throw new Error(sibErr.message);
        const existingByLang = new Map<string, string>();
        for (const r of siblings ?? []) existingByLang.set(r.language, r.id);

        let titleTrans: Partial<Record<"en" | "jp", string>> = {};
        if (type.title.trim()) {
          const r = await translateText(type.title, ["en", "jp"], "Live2D 타입 카드 제목");
          titleTrans = r.translations;
        }

        for (const lang of ["en", "jp"] as const) {
          const title = titleTrans[lang] ?? type.title;
          const existingId = existingByLang.get(lang);
          if (existingId) {
            const { error } = await supabase
              .from("live2d_types")
              .update({ title })
              .eq("id", existingId);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await supabase.from("live2d_types").insert({
              type_key: type.type_key,
              title,
              order_num: type.order_num,
              language: lang,
              translation_key: type.translation_key,
            });
            if (error) throw new Error(error.message);
          }
        }
        successCount++;
      } catch (e) {
        failCount++;
        const msg = e instanceof Error ? e.message : "unknown error";
        console.error(`[admin/process] translation failed for type ${type.id}:`, msg);
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
        language: locale,
        translation_key: crypto.randomUUID(),
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

  async function deleteStep(step: ProcessStep) {
    const supabase = createClient();
    const scope = await deleteScope.ask({
      supabase,
      table: "process_steps",
      translationKey: step.translation_key,
      currentLocale: locale,
      itemHint: step.title || undefined,
    });
    if (scope === "cancelled") return;

    saveNotifier.notifySaving();
    const query =
      scope === "all"
        ? supabase
            .from("process_steps")
            .delete()
            .eq("translation_key", step.translation_key)
        : supabase.from("process_steps").delete().eq("id", step.id);
    const { error } = await query;
    if (error) {
      console.error("[admin/process] delete step failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    setSteps((prev) => prev.filter((s) => s.id !== step.id));
    saveNotifier.notifySaved();
    router.refresh();
  }

  function updateStepLocal(id: string, patch: Partial<ProcessStep>) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  // persistStep 제거 — handleSaveAll 이 일괄 처리.

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
        language: locale,
        translation_key: crypto.randomUUID(),
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

  async function deleteType(type: Live2DType) {
    // live2d_type_items 는 부모 ON DELETE CASCADE 로 함께 정리.
    const supabase = createClient();
    const scope = await deleteScope.ask({
      supabase,
      table: "live2d_types",
      translationKey: type.translation_key,
      currentLocale: locale,
      itemHint: type.title || type.type_key || undefined,
    });
    if (scope === "cancelled") return;

    saveNotifier.notifySaving();
    const query =
      scope === "all"
        ? supabase
            .from("live2d_types")
            .delete()
            .eq("translation_key", type.translation_key)
        : supabase.from("live2d_types").delete().eq("id", type.id);
    const { error } = await query;
    if (error) {
      console.error("[admin/process] delete type failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    setTypes((prev) => prev.filter((t) => t.id !== type.id));
    saveNotifier.notifySaved();
    router.refresh();
  }

  function updateTypeLocal(id: string, patch: Partial<Live2DType>) {
    setTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }

  // persistType 제거 — handleSaveAll 이 일괄 처리.

  // ─────────── Live2DTypeItems mutations (각 타입 카드의 자식 항목들) ───────────
  async function addTypeItem(typeId: string) {
    saveNotifier.notifySaving();
    const siblings = typeItems.filter((i) => i.type_id === typeId);
    const max =
      siblings.length === 0
        ? -1
        : Math.max(...siblings.map((i) => i.order_num));
    const supabase = createClient();
    // 008 이후 language + translation_key 필수. 부모(types) 와 같은 locale 로 INSERT.
    const { data, error } = await supabase
      .from("live2d_type_items")
      .insert({
        type_id: typeId,
        label: null,
        value: "",
        order_num: max + 1,
        language: locale,
        translation_key: crypto.randomUUID(),
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

  async function deleteTypeItem(item: Live2DTypeItem) {
    const supabase = createClient();
    const scope = await deleteScope.ask({
      supabase,
      table: "live2d_type_items",
      translationKey: item.translation_key,
      currentLocale: locale,
      itemHint: item.value || item.label || undefined,
    });
    if (scope === "cancelled") return;

    saveNotifier.notifySaving();
    const query =
      scope === "all"
        ? supabase
            .from("live2d_type_items")
            .delete()
            .eq("translation_key", item.translation_key)
        : supabase.from("live2d_type_items").delete().eq("id", item.id);
    const { error } = await query;
    if (error) {
      console.error("[admin/process] delete type item failed:", error.message);
      saveNotifier.notifyError();
      return;
    }
    setTypeItems((prev) => prev.filter((i) => i.id !== item.id));
    saveNotifier.notifySaved();
    router.refresh();
  }

  function updateTypeItemLocal(id: string, patch: Partial<Live2DTypeItem>) {
    setTypeItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }

  // persistTypeItem 제거 — handleSaveAll 이 일괄 처리.

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

        {/* 빈 상태는 각 Section 내부의 안내 메시지 + "+ 추가" 버튼이 처리. */}
        <ProcessStepsSection
          steps={visibleSteps}
          onAdd={addStep}
          onDelete={(step) => deleteStep(step)}
          onUpdateLocal={updateStepLocal}
          onDragEnd={handleStepsDragEnd}
        />

        {activeCategory === "live2d" && (
          <Live2DTypesSection
            types={[...types].sort((a, b) => a.order_num - b.order_num)}
            typeItems={typeItems}
            onAdd={addType}
            onDelete={(type) => deleteType(type)}
            onUpdateLocal={updateTypeLocal}
            onDragEnd={handleTypesDragEnd}
            onAddItem={addTypeItem}
            onDeleteItem={deleteTypeItem}
            onUpdateItemLocal={updateTypeItemLocal}
            onItemsDragEnd={handleTypeItemsDragEnd}
          />
        )}

      </div>
      <AdminSaveBar dirtyCount={dirtyCount} onSave={handleSaveAll} />
      {deleteScope.portal}
    </SaveStateContext.Provider>
  );
}

// ─────────────── ProcessSteps section ───────────────
function ProcessStepsSection({
  steps,
  onAdd,
  onDelete,
  onUpdateLocal,
  onDragEnd,
}: {
  steps: ProcessStep[];
  onAdd: () => void;
  onDelete: (step: ProcessStep) => void;
  onUpdateLocal: (id: string, patch: Partial<ProcessStep>) => void;
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
                onDelete={() => onDelete(step)}
                onUpdateLocal={(patch) => onUpdateLocal(step.id, patch)}
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
}: {
  step: ProcessStep;
  stepIndex: number;
  onDelete: () => void;
  onUpdateLocal: (patch: Partial<ProcessStep>) => void;
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
        onChange={(e) => onUpdateLocal({ title: e.target.value })}
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
            autoSave={false}
            onChange={(html) => onUpdateLocal({ description: html })}
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
  onDragEnd,
  onAddItem,
  onDeleteItem,
  onUpdateItemLocal,
  onItemsDragEnd,
}: {
  types: Live2DType[];
  typeItems: Live2DTypeItem[];
  onAdd: () => void;
  onDelete: (type: Live2DType) => void;
  onUpdateLocal: (id: string, patch: Partial<Live2DType>) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onAddItem: (typeId: string) => void;
  onDeleteItem: (item: Live2DTypeItem) => void;
  onUpdateItemLocal: (id: string, patch: Partial<Live2DTypeItem>) => void;
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
                  onDelete={() => onDelete(type)}
                  onUpdateLocal={(patch) => onUpdateLocal(type.id, patch)}
                  onAddItem={() => onAddItem(type.id)}
                  onDeleteItem={onDeleteItem}
                  onUpdateItemLocal={onUpdateItemLocal}
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
  onAddItem,
  onDeleteItem,
  onUpdateItemLocal,
  onItemsDragEnd,
}: {
  type: Live2DType;
  items: Live2DTypeItem[];
  onDelete: () => void;
  onUpdateLocal: (patch: Partial<Live2DType>) => void;
  onAddItem: () => void;
  onDeleteItem: (item: Live2DTypeItem) => void;
  onUpdateItemLocal: (id: string, patch: Partial<Live2DTypeItem>) => void;
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

  // 항목 dnd 용 별도 sensor — 타입 카드 dnd 와는 별개의 컨텍스트.
  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
        onChange={(e) => onUpdateLocal({ type_key: e.target.value })}
      />

      <input
        type="text"
        className="admin-form-input admin-type-title"
        value={type.title}
        placeholder="카드 제목"
        onChange={(e) => onUpdateLocal({ title: e.target.value })}
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
                  onDelete={() => onDeleteItem(item)}
                  onUpdateLocal={(patch) => onUpdateItemLocal(item.id, patch)}
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
}: {
  item: Live2DTypeItem;
  onDelete: () => void;
  onUpdateLocal: (patch: Partial<Live2DTypeItem>) => void;
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
          onUpdateLocal({ label: next.length === 0 ? null : next });
        }}
      />

      <input
        type="text"
        className="admin-form-input admin-type-item-input"
        value={item.value}
        placeholder="값"
        onChange={(e) => onUpdateLocal({ value: e.target.value })}
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
