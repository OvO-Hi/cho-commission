"use client";

import { createClient } from "@/lib/supabase/client";
import type { SampleBlock } from "@/types/database";

import { useSaveStateNotifier } from "./save-state";

const DEFAULT_HEIGHT = 200;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 600;

type Props = {
  block: SampleBlock;
  // 이미지 블록의 row_height 를 즉시 부모 state 에 반영하기 위함.
  onUpdate: (patch: Partial<SampleBlock>) => void;
};

// 이미지 row 블록의 높이 조절 핸들. 블록 카드 바깥(아래) 에 단독 막대로 위치.
// 드래그 중에는 onUpdate 로 로컬 state 만 갱신하고, 드래그 종료 시 DB save.
export default function ImageRowHeightHandle({ block, onUpdate }: Props) {
  const notifier = useSaveStateNotifier();
  const currentHeight = block.row_height ?? DEFAULT_HEIGHT;

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = currentHeight;
    let lastHeight = startHeight;

    function onMove(ev: PointerEvent) {
      const dy = ev.clientY - startY;
      // pointer 이벤트의 clientY 가 sub-pixel(소수) 일 수 있어 미리 정수로 반올림.
      // sample_blocks.row_height 가 INTEGER 컬럼이라 소수점 값 INSERT 시 Postgres 가 거부함.
      const next = Math.round(
        Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + dy)),
      );
      lastHeight = next;
      onUpdate({ row_height: next });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      void save(lastHeight);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function save(newHeight: number) {
    notifier?.notifySaving();
    const supabase = createClient();
    // INTEGER 컬럼 안전장치 — onMove 에서 이미 round 되지만 호출 경로가 늘어나도 안전.
    const value = Math.round(newHeight);
    const { error } = await supabase
      .from("sample_blocks")
      .update({ row_height: value })
      .eq("id", block.id);
    if (error) {
      console.error(
        "[admin/samples/image-height] save failed:",
        error.message,
      );
      notifier?.notifyError();
      return;
    }
    notifier?.notifySaved();
  }

  return (
    <div
      className="admin-block-image-h-handle"
      onPointerDown={startDrag}
      role="separator"
      aria-orientation="horizontal"
      aria-label="이미지 높이 조절"
    />
  );
}
