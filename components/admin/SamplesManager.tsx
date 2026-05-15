"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SaveStateContext,
  type SaveStateNotifier,
} from "./sample-blocks/save-state";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { type SampleBlockWithImages } from "@/components/SamplePageRenderer";
import { createClient } from "@/lib/supabase/client";
import {
  deleteImage,
  extractStoragePath,
} from "@/lib/storage/upload";
import type {
  CommissionCategory,
  SampleBlock,
  SampleBlockType,
  SampleImage,
} from "@/types/database";

import SamplesPreviewModal from "./SamplesPreviewModal";
import BlockCard from "./sample-blocks/BlockCard";

const CATEGORIES: { id: CommissionCategory; label: string }[] = [
  { id: "live2d", label: "Live2D 샘플" },
  { id: "illust", label: "Illust 샘플" },
];

const BLOCK_OPTIONS: { type: SampleBlockType; label: string }[] = [
  { type: "text", label: "텍스트 블록" },
  { type: "youtube", label: "유튜브 블록" },
  { type: "image_row", label: "이미지 블록" },
  { type: "divider", label: "구분선" },
];

type Props = {
  initialBlocks: SampleBlock[];
  initialImages: SampleImage[];
};

export default function SamplesManager({
  initialBlocks,
  initialImages,
}: Props) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] =
    useState<CommissionCategory>("live2d");
  const [blocks, setBlocks] = useState<SampleBlock[]>(initialBlocks);
  const [images, setImages] = useState<SampleImage[]>(initialImages);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // 자동 저장 인디케이터 상태. saved 상태는 2초 후 idle 로 자동 복귀.
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

  // 서버가 router.refresh() 후 보낸 새 initial 동기화.
  useEffect(() => setBlocks(initialBlocks), [initialBlocks]);
  useEffect(() => setImages(initialImages), [initialImages]);

  // 추가 메뉴 외부 클릭 시 닫기.
  useEffect(() => {
    if (!showAddMenu) return;
    function onClick(e: MouseEvent) {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(e.target as Node)
      ) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showAddMenu]);

  const visibleBlocks = useMemo(
    () =>
      blocks
        .filter((b) => b.category === activeCategory)
        .sort((a, b) => a.order_num - b.order_num),
    [blocks, activeCategory],
  );

  // 미리보기 모달 / 사용자 페이지에 전달할 형태로 미리 join.
  // 클라이언트 메모리의 현재 state 기준이라 자동 저장 전이라도 보이는 그대로 반영됩니다.
  const visibleBlocksWithImages = useMemo<SampleBlockWithImages[]>(
    () =>
      visibleBlocks.map((b) => ({
        ...b,
        images:
          b.block_type === "image_row"
            ? images.filter((img) => img.block_id === b.id)
            : [],
      })),
    [visibleBlocks, images],
  );

  // 드래그 시작 임계값 — textarea/input 클릭과 충돌 방지.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleAddBlock(type: SampleBlockType) {
    setShowAddMenu(false);
    if (busy) return;
    setBusy(true);
    saveNotifier.notifySaving();

    const max =
      visibleBlocks.length === 0
        ? -1
        : Math.max(...visibleBlocks.map((b) => b.order_num));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sample_blocks")
      .insert({
        category: activeCategory,
        block_type: type,
        order_num: max + 1,
        text_content: type === "text" ? "" : null,
        youtube_url: type === "youtube" ? "" : null,
        row_height: type === "image_row" ? 200 : null,
      })
      .select()
      .single();

    setBusy(false);
    if (error || !data) {
      console.error("[admin/samples] add block failed:", error?.message);
      saveNotifier.notifyError();
      return;
    }
    setBlocks((prev) => [...prev, data]);
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function handleDeleteBlock(blockId: string) {
    if (busy) return;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    // 이미지 블록은 자식 이미지가 함께 사라지므로 더 강한 confirm.
    const isImageRow = block.block_type === "image_row";
    const message = isImageRow
      ? "이 블록의 모든 이미지가 함께 삭제됩니다. 계속할까요?"
      : "이 블록을 삭제할까요?";
    if (!window.confirm(message)) return;

    setBusy(true);
    saveNotifier.notifySaving();
    const supabase = createClient();

    // 이미지 블록은 Storage 파일 + sample_images row 정리 후 본 row 삭제.
    if (isImageRow) {
      const childImages = images.filter((img) => img.block_id === blockId);
      // best-effort Storage 정리
      for (const img of childImages) {
        const path = extractStoragePath(img.image_url, "samples");
        if (path) await deleteImage("samples", path);
      }
      // CASCADE 가 설정돼 있으면 이 줄은 필수 아님 — 안전 차원에서 명시.
      await supabase.from("sample_images").delete().eq("block_id", blockId);
    }

    const { error } = await supabase
      .from("sample_blocks")
      .delete()
      .eq("id", blockId);
    setBusy(false);
    if (error) {
      console.error("[admin/samples] delete block failed:", error.message);
      saveNotifier.notifyError();
      return;
    }

    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (isImageRow) {
      setImages((prev) => prev.filter((img) => img.block_id !== blockId));
    }
    saveNotifier.notifySaved();
    router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleBlocks.findIndex((b) => b.id === active.id);
    const newIndex = visibleBlocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(visibleBlocks, oldIndex, newIndex);
    const updates = reordered.map((b, i) => ({ id: b.id, order_num: i }));

    // 낙관적 UI 업데이트
    setBlocks((prev) =>
      prev.map((b) => {
        const u = updates.find((x) => x.id === b.id);
        return u ? { ...b, order_num: u.order_num } : b;
      }),
    );

    // 일괄 UPDATE — bulk upsert 대신 병렬 update 로 단순화.
    saveNotifier.notifySaving();
    const supabase = createClient();
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("sample_blocks")
          .update({ order_num: u.order_num })
          .eq("id", u.id),
      ),
    );
    if (results.some((r) => r.error)) {
      saveNotifier.notifyError();
    } else {
      saveNotifier.notifySaved();
    }
    router.refresh();
  }

  function updateBlockLocal(blockId: string, patch: Partial<SampleBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    );
  }

  function updateImagesLocal(
    updater: (prev: SampleImage[]) => SampleImage[],
  ) {
    setImages(updater);
  }

  return (
    <div className="admin-main-card">
      <h1 className="admin-main-title">샘플 페이지 관리</h1>
      <p className="admin-samples-sub">
        Live2D / Illust 샘플 페이지 콘텐츠를 관리할 수 있어요
      </p>

      <div className="admin-samples-toolbar">
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

        <div className="admin-samples-toolbar-right">
          {/* 자동 저장 인디케이터 — saving / saved / error 상태 표시. idle 일 때는 빈 공간 유지. */}
          <div
            className={`admin-samples-save-indicator admin-samples-save-${saveState}`}
            aria-live="polite"
          >
            {saveState === "saving" && "저장 중..."}
            {saveState === "saved" && "✓ 저장됨"}
            {saveState === "error" && "저장 실패"}
          </div>

          <button
            type="button"
            className="admin-samples-preview-btn"
            onClick={() => setPreviewOpen(true)}
          >
            👁 미리보기
          </button>
        </div>
      </div>

      <SaveStateContext.Provider value={saveNotifier}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleBlocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="admin-samples-blocks">
              {visibleBlocks.length === 0 && (
                <p className="admin-samples-empty">
                  아직 블록이 없어요. 아래 + 블록 추가 로 첫 블록을 만들어 보세요.
                </p>
              )}
              {visibleBlocks.map((block) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  images={images.filter((img) => img.block_id === block.id)}
                  onDelete={() => handleDeleteBlock(block.id)}
                  onUpdate={(patch) => updateBlockLocal(block.id, patch)}
                  onImagesChange={updateImagesLocal}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </SaveStateContext.Provider>

      <SamplesPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        blocks={visibleBlocksWithImages}
        category={activeCategory}
      />

      <div className="admin-samples-add" ref={addMenuRef}>
        <button
          type="button"
          className="admin-samples-add-btn"
          onClick={() => setShowAddMenu((v) => !v)}
          disabled={busy}
        >
          + 블록 추가
        </button>
        {showAddMenu && (
          <div className="admin-samples-add-menu" role="menu">
            {BLOCK_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                role="menuitem"
                className="admin-samples-add-item"
                onClick={() => handleAddBlock(opt.type)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
