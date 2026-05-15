"use client";

import { createClient } from "@/lib/supabase/client";
import type { SampleBlock } from "@/types/database";

import RichTextEditor from "../RichTextEditor";

type Props = {
  block: SampleBlock;
  onUpdate: (patch: Partial<SampleBlock>) => void;
};

// 샘플 텍스트 블록 = 공용 RichTextEditor + sample_blocks 저장 로직 연결.
export default function TextBlockEditor({ block, onUpdate }: Props) {
  return (
    <RichTextEditor
      value={block.text_content || ""}
      onSave={async (html) => {
        const supabase = createClient();
        const { error } = await supabase
          .from("sample_blocks")
          .update({ text_content: html })
          .eq("id", block.id);
        if (error) throw new Error(error.message);
        onUpdate({ text_content: html });
      }}
    />
  );
}
