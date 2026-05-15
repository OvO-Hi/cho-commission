"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { SampleBlock } from "@/types/database";

import { extractYouTubeVideoId } from "@/lib/utils/youtube";

import { useSaveStateNotifier } from "./save-state";

const SAVE_DEBOUNCE_MS = 600;

type Props = {
  block: SampleBlock;
  onUpdate: (patch: Partial<SampleBlock>) => void;
};

export default function YouTubeBlockEditor({ block, onUpdate }: Props) {
  const [value, setValue] = useState(block.youtube_url ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifier = useSaveStateNotifier();

  useEffect(() => {
    setValue(block.youtube_url ?? "");
  }, [block.id, block.youtube_url]);

  const videoId = extractYouTubeVideoId(value);

  function scheduleSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(next), SAVE_DEBOUNCE_MS);
  }

  async function save(next: string) {
    notifier?.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("sample_blocks")
      .update({ youtube_url: next })
      .eq("id", block.id);
    if (error) {
      console.error("[admin/samples/youtube] save failed:", error.message);
      notifier?.notifyError();
      return;
    }
    onUpdate({ youtube_url: next });
    notifier?.notifySaved();
  }

  return (
    <div className="admin-block-youtube">
      <input
        type="text"
        className="admin-form-input"
        value={value}
        placeholder="유튜브 URL을 입력하세요 (예: https://youtu.be/...)"
        onChange={(e) => {
          setValue(e.target.value);
          scheduleSave(e.target.value);
        }}
        onBlur={() => {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
            void save(value);
          }
        }}
      />
      {videoId && (
        <div className="admin-block-youtube-preview">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube 미리보기"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {value && !videoId && (
        <p className="admin-block-youtube-warn">
          유효한 YouTube URL 형식이 아니에요. (예: https://youtu.be/XXXXXXXXXXX)
        </p>
      )}
    </div>
  );
}
