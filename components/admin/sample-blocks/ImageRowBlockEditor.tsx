"use client";

import { ChangeEvent, Fragment, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  deleteImage,
  extractStoragePath,
  uploadImage,
} from "@/lib/storage/upload";
import type { SampleBlock, SampleImage } from "@/types/database";

import { useSaveStateNotifier } from "./save-state";

const MAX_IMAGES = 4;
// height 상수는 ImageRowHeightHandle.tsx 로 이전. 여기서는 기본값 fallback 만 필요.
const DEFAULT_HEIGHT = 200;
const MIN_RATIO = 0.3;

type Props = {
  block: SampleBlock;
  images: SampleImage[];
  onUpdate: (patch: Partial<SampleBlock>) => void;
  onImagesChange: (updater: (prev: SampleImage[]) => SampleImage[]) => void;
};

export default function ImageRowBlockEditor({
  block,
  images,
  onUpdate,
  onImagesChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const notifier = useSaveStateNotifier();

  const sortedImages = [...images].sort(
    (a, b) => a.order_num - b.order_num,
  );
  const height = block.row_height ?? DEFAULT_HEIGHT;
  const canAdd = sortedImages.length < MAX_IMAGES;

  const totalRatio =
    sortedImages.reduce((sum, img) => sum + img.width_ratio, 0) || 1;

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy || !canAdd) return;
    if (!file.type.startsWith("image/")) return;

    setBusy(true);
    notifier?.notifySaving();
    // samples/{category}/{block_id}/ 폴더에 저장 → 블록 단위 정리 용이.
    const result = await uploadImage(
      file,
      "samples",
      `${block.category}/${block.id}`,
    );
    if (!result) {
      setBusy(false);
      notifier?.notifyError();
      return;
    }

    const supabase = createClient();
    const nextOrderNum =
      sortedImages.length === 0
        ? 0
        : Math.max(...sortedImages.map((i) => i.order_num)) + 1;
    const { data, error } = await supabase
      .from("sample_images")
      .insert({
        block_id: block.id,
        image_url: result.url,
        order_num: nextOrderNum,
        width_ratio: 1,
      })
      .select()
      .single();

    if (error || !data) {
      console.error(
        "[admin/samples/image] insert failed:",
        error?.message,
      );
      // INSERT 실패 시 업로드된 Storage 파일 cleanup.
      await deleteImage("samples", result.path);
      setBusy(false);
      notifier?.notifyError();
      return;
    }

    onImagesChange((prev) => [...prev, data]);
    setBusy(false);
    notifier?.notifySaved();
  }

  async function deleteImg(img: SampleImage) {
    if (busy) return;
    setBusy(true);
    notifier?.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("sample_images")
      .delete()
      .eq("id", img.id);
    if (error) {
      console.error("[admin/samples/image] delete failed:", error.message);
      notifier?.notifyError();
      setBusy(false);
      return;
    }
    const path = extractStoragePath(img.image_url, "samples");
    if (path) await deleteImage("samples", path);
    onImagesChange((prev) => prev.filter((i) => i.id !== img.id));
    notifier?.notifySaved();
    setBusy(false);
  }

  // 두 이미지 사이의 너비 비율 드래그.
  function startWidthDrag(e: React.PointerEvent, leftIdx: number) {
    e.preventDefault();
    if (!rowRef.current) return;
    const rowWidth = rowRef.current.clientWidth;
    const left = sortedImages[leftIdx];
    const right = sortedImages[leftIdx + 1];
    if (!left || !right) return;

    const startX = e.clientX;
    const startLeft = left.width_ratio;
    const startRight = right.width_ratio;
    // dx → ratio 변환 시 사용. 두 이미지 비율 합을 보존.
    const pairTotal = startLeft + startRight;
    let lastLeft = startLeft;
    let lastRight = startRight;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      // 두 이미지가 차지하는 가로 픽셀 합 추정 — 단순화해 row 너비 사용.
      const ratioDelta = (dx / rowWidth) * totalRatio;
      let newLeft = startLeft + ratioDelta;
      let newRight = startRight - ratioDelta;
      // 양쪽 모두 최소값 보장.
      if (newLeft < MIN_RATIO) {
        newLeft = MIN_RATIO;
        newRight = pairTotal - MIN_RATIO;
      }
      if (newRight < MIN_RATIO) {
        newRight = MIN_RATIO;
        newLeft = pairTotal - MIN_RATIO;
      }
      lastLeft = newLeft;
      lastRight = newRight;

      onImagesChange((prev) =>
        prev.map((i) => {
          if (i.id === left.id) return { ...i, width_ratio: newLeft };
          if (i.id === right.id) return { ...i, width_ratio: newRight };
          return i;
        }),
      );
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // 드래그 종료 시 두 이미지의 width_ratio 만 일괄 저장.
      void saveRatios([
        { id: left.id, width_ratio: lastLeft },
        { id: right.id, width_ratio: lastRight },
      ]);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function saveRatios(
    items: { id: string; width_ratio: number }[],
  ) {
    notifier?.notifySaving();
    const supabase = createClient();
    const results = await Promise.all(
      items.map((it) =>
        supabase
          .from("sample_images")
          .update({ width_ratio: it.width_ratio })
          .eq("id", it.id),
      ),
    );
    if (results.some((r) => r.error)) notifier?.notifyError();
    else notifier?.notifySaved();
  }

  return (
    <div className="admin-block-image-row">
      {sortedImages.length === 0 ? (
        <div
          className="admin-block-image-empty"
          style={{ height }}
        >
          이미지를 추가해 주세요
        </div>
      ) : (
        <div
          ref={rowRef}
          className="admin-block-image-row-images"
          style={{ height }}
        >
          {sortedImages.map((img, idx) => (
            <Fragment key={img.id}>
              <div
                className="admin-block-image-cell"
                style={{
                  flexGrow: img.width_ratio / totalRatio,
                  flexBasis: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url} alt="" />
                <button
                  type="button"
                  className="admin-block-image-remove"
                  onClick={() => deleteImg(img)}
                  disabled={busy}
                  aria-label="이미지 삭제"
                >
                  ✕
                </button>
              </div>
              {idx < sortedImages.length - 1 && (
                <div
                  className="admin-block-image-w-handle"
                  onPointerDown={(e) => startWidthDrag(e, idx)}
                  aria-label="너비 조절"
                  role="separator"
                  aria-orientation="vertical"
                />
              )}
            </Fragment>
          ))}
        </div>
      )}

      <div className="admin-block-image-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <button
          type="button"
          className={`admin-block-image-add${canAdd ? "" : " admin-block-image-add-disabled"}`}
          onClick={openFilePicker}
          disabled={!canAdd || busy}
        >
          + 이미지 추가 ({sortedImages.length}/{MAX_IMAGES})
        </button>
      </div>
    </div>
  );
}
