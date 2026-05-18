"use client";

import { useEffect, useRef } from "react";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Underline 은 최신 StarterKit 에 이미 포함되어 있어 별도 import 시 중복 등록 경고 발생.
// (기존 코드에서 명시적으로 추가했으나 제거.)

import { useSaveStateNotifier } from "./sample-blocks/save-state";

const SAVE_DEBOUNCE_MS = 600;

type Props = {
  // 초기 HTML(또는 plain text). 값이 바뀌어도 에디터 내용은 재마운트가 아니면 유지됩니다 —
  // key 로 인스턴스를 분리하거나 부모에서 관리하세요.
  value: string;
  // autoSave=true(기본): debounce 후 onSave 자동 호출. 기존 동작.
  // autoSave=false: onSave 자동 호출 안 함. 부모가 onChange 를 받아 dirty 추적 + 외부 "저장" 버튼.
  autoSave?: boolean;
  onSave?: (html: string) => Promise<void>;
  onChange?: (html: string) => void;
};

export default function RichTextEditor({
  value,
  autoSave = true,
  onSave,
  onChange,
}: Props) {
  const notifier = useSaveStateNotifier();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValueRef = useRef<string>(value);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "admin-block-rich-content",
      },
    },
    immediatelyRender: false,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      lastValueRef.current = html;
      onChange?.(html);
      if (!autoSave) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void doSave(html);
      }, SAVE_DEBOUNCE_MS);
    },
    onBlur() {
      if (!autoSave) return;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        void doSave(lastValueRef.current);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function doSave(html: string) {
    if (!onSave) return;
    notifier?.notifySaving();
    try {
      await onSave(html);
      notifier?.notifySaved();
    } catch (err) {
      console.error("[rich-text] save failed:", err);
      notifier?.notifyError();
    }
  }

  if (!editor) {
    return <div className="admin-block-rich admin-block-rich-loading" />;
  }

  return (
    <div className="admin-block-rich">
      <div className="admin-block-rich-toolbar" role="toolbar">
        <ToolbarBtn
          label="굵게"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn
          label="기울임"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarBtn>
        <ToolbarBtn
          label="밑줄"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span style={{ textDecoration: "underline" }}>U</span>
        </ToolbarBtn>

        <span className="admin-block-rich-divider" aria-hidden />

        <ToolbarBtn
          label="제목 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          H1
        </ToolbarBtn>
        <ToolbarBtn
          label="제목 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </ToolbarBtn>
        <ToolbarBtn
          label="본문"
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          본문
        </ToolbarBtn>

        <span className="admin-block-rich-divider" aria-hidden />

        <ToolbarBtn
          label="번호 리스트"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarBtn>
        <ToolbarBtn
          label="불릿 리스트"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolbarBtn>

        <span className="admin-block-rich-divider" aria-hidden />

        <ToolbarBtn
          label="좌측 정렬"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          ⇤
        </ToolbarBtn>
        <ToolbarBtn
          label="가운데 정렬"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() =>
            editor.chain().focus().setTextAlign("center").run()
          }
        >
          ↔
        </ToolbarBtn>
        <ToolbarBtn
          label="우측 정렬"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          ⇥
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`admin-block-rich-btn${active ? " admin-block-rich-btn-active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
