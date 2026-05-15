"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { SampleBlock, SampleImage } from "@/types/database";

import DividerBlockEditor from "./DividerBlockEditor";
import ImageRowBlockEditor from "./ImageRowBlockEditor";
import ImageRowHeightHandle from "./ImageRowHeightHandle";
import TextBlockEditor from "./TextBlockEditor";
import YouTubeBlockEditor from "./YouTubeBlockEditor";

const BLOCK_TYPE_LABEL: Record<SampleBlock["block_type"], string> = {
  text: "텍스트",
  youtube: "유튜브",
  image_row: "이미지",
  divider: "구분선",
};

type Props = {
  block: SampleBlock;
  images: SampleImage[];
  onDelete: () => void;
  onUpdate: (patch: Partial<SampleBlock>) => void;
  onImagesChange: (updater: (prev: SampleImage[]) => SampleImage[]) => void;
};

export default function BlockCard({
  block,
  images,
  onDelete,
  onUpdate,
  onImagesChange,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    // wrapper 가 sortable 단위 — 카드 + (이미지 블록의 경우) height handle 을 함께 묶어
    // 드래그 시 한 덩어리로 이동. 카드 회색 테두리 바깥에 height handle 이 시각적으로 분리됩니다.
    <div
      ref={setNodeRef}
      style={style}
      className={`admin-block-wrapper${isDragging ? " admin-block-wrapper-dragging" : ""}`}
    >
      <div className="admin-block-card">
        {/* 좌측 드래그 핸들 — 이 영역만 드래그 트리거 (textarea/input 위 드래그 방지). */}
        <button
          type="button"
          className="admin-block-handle"
          aria-label="블록 순서 드래그"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>

        <div className="admin-block-body">
          <div className="admin-block-type-tag">
            {BLOCK_TYPE_LABEL[block.block_type]}
          </div>

          {block.block_type === "text" && (
            <TextBlockEditor block={block} onUpdate={onUpdate} />
          )}
          {block.block_type === "youtube" && (
            <YouTubeBlockEditor block={block} onUpdate={onUpdate} />
          )}
          {block.block_type === "image_row" && (
            <ImageRowBlockEditor
              block={block}
              images={images}
              onUpdate={onUpdate}
              onImagesChange={onImagesChange}
            />
          )}
          {block.block_type === "divider" && <DividerBlockEditor />}
        </div>

        <button
          type="button"
          className="admin-block-delete"
          onClick={onDelete}
          aria-label="블록 삭제"
        >
          ✕
        </button>
      </div>

      {/* 이미지 블록만 카드 바깥(아래) 에 높이 조절 핸들 노출. 다른 블록 타입에는 표시 안 됨. */}
      {block.block_type === "image_row" && (
        <ImageRowHeightHandle block={block} onUpdate={onUpdate} />
      )}
    </div>
  );
}
