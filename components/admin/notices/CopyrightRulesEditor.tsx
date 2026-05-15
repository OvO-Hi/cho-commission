"use client";

import { useEffect, useRef, useState } from "react";
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

import { useSaveStateNotifier } from "@/components/admin/sample-blocks/save-state";
import { createClient } from "@/lib/supabase/client";
import type { CopyrightRule } from "@/types/database";

const SAVE_DEBOUNCE_MS = 500;

type ColumnKey = Extract<
  keyof CopyrightRule,
  "allow_personal" | "allow_sns" | "allow_broadcast" | "allow_youtube" | "allow_goods"
>;

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "allow_personal", label: "개인소장" },
  { key: "allow_sns", label: "SNS 업로드" },
  { key: "allow_broadcast", label: "방송 사용" },
  { key: "allow_youtube", label: "유튜브" },
  { key: "allow_goods", label: "굿즈 및 판매" },
];

type Props = {
  initial: CopyrightRule[];
};

export default function CopyrightRulesEditor({ initial }: Props) {
  const router = useRouter();
  const notifier = useSaveStateNotifier();
  const [rules, setRules] = useState<CopyrightRule[]>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setRules(initial), [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function addRow() {
    if (busy) return;
    setBusy(true);
    notifier?.notifySaving();
    const max =
      rules.length === 0 ? -1 : Math.max(...rules.map((r) => r.order_num));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("copyright_rules")
      .insert({
        label: "",
        allow_personal: false,
        allow_sns: false,
        allow_broadcast: false,
        allow_youtube: false,
        allow_goods: false,
        order_num: max + 1,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      console.error("[admin/notices/copyright] add failed:", error?.message);
      notifier?.notifyError();
      return;
    }
    setRules((prev) => [...prev, data]);
    notifier?.notifySaved();
    router.refresh();
  }

  async function deleteRow(id: number) {
    if (busy) return;
    setBusy(true);
    notifier?.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("copyright_rules")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (error) {
      console.error("[admin/notices/copyright] delete failed:", error.message);
      notifier?.notifyError();
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
    notifier?.notifySaved();
    router.refresh();
  }

  async function updateRow(
    id: number,
    patch: Partial<Omit<CopyrightRule, "id" | "created_at">>,
  ) {
    notifier?.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("copyright_rules")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[admin/notices/copyright] update failed:", error.message);
      notifier?.notifyError();
      return;
    }
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    notifier?.notifySaved();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rules.findIndex((r) => r.id === active.id);
    const newIndex = rules.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(rules, oldIndex, newIndex);
    const updates = reordered.map((r, i) => ({ id: r.id, order_num: i }));
    // 낙관적 업데이트
    setRules(reordered.map((r, i) => ({ ...r, order_num: i })));

    notifier?.notifySaving();
    const supabase = createClient();
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("copyright_rules")
          .update({ order_num: u.order_num })
          .eq("id", u.id),
      ),
    );
    if (results.some((r) => r.error)) notifier?.notifyError();
    else notifier?.notifySaved();
    router.refresh();
  }

  const sorted = [...rules].sort((a, b) => a.order_num - b.order_num);

  return (
    <div className="admin-copyright">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <table className="admin-copyright-table">
          <thead>
            <tr>
              <th aria-label="순서" className="admin-copyright-handle-col" />
              <th className="admin-copyright-label-col">라벨</th>
              {COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th aria-label="삭제" className="admin-copyright-delete-col" />
            </tr>
          </thead>
          <SortableContext
            items={sorted.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <tbody>
              {sorted.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onUpdate={(patch) => updateRow(rule.id, patch)}
                  onDelete={() => deleteRow(rule.id)}
                  disabled={busy}
                />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + COLUMNS.length + 1}
                    className="admin-copyright-empty"
                  >
                    행이 없어요. 아래 + 행 추가 로 첫 행을 만들어 보세요.
                  </td>
                </tr>
              )}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>

      <button
        type="button"
        className="admin-copyright-add"
        onClick={addRow}
        disabled={busy}
      >
        + 행 추가
      </button>
    </div>
  );
}

function RuleRow({
  rule,
  onUpdate,
  onDelete,
  disabled,
}: {
  rule: CopyrightRule;
  onUpdate: (patch: Partial<Omit<CopyrightRule, "id" | "created_at">>) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const [label, setLabel] = useState(rule.label);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 외부 변경 동기화 (router.refresh 후 등).
  useEffect(() => setLabel(rule.label), [rule.id, rule.label]);

  // 라벨 입력 디바운스 저장.
  function scheduleLabelSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (next !== rule.label) onUpdate({ label: next });
    }, SAVE_DEBOUNCE_MS);
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="admin-copyright-row">
      <td className="admin-copyright-handle-col">
        <button
          type="button"
          className="admin-copyright-handle"
          aria-label="드래그"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      </td>
      <td>
        <input
          type="text"
          className="admin-form-input admin-copyright-label-input"
          value={label}
          placeholder="예: 방송용"
          onChange={(e) => {
            setLabel(e.target.value);
            scheduleLabelSave(e.target.value);
          }}
          onBlur={() => {
            if (debounceRef.current) {
              clearTimeout(debounceRef.current);
              debounceRef.current = null;
              if (label !== rule.label) onUpdate({ label });
            }
          }}
          disabled={disabled}
        />
      </td>
      {COLUMNS.map((c) => (
        <td key={c.key} className="admin-copyright-check-cell">
          <input
            type="checkbox"
            className="admin-copyright-check"
            checked={Boolean(rule[c.key])}
            onChange={(e) => onUpdate({ [c.key]: e.target.checked })}
            disabled={disabled}
            aria-label={c.label}
          />
        </td>
      ))}
      <td className="admin-copyright-delete-col">
        <button
          type="button"
          className="admin-block-delete"
          onClick={onDelete}
          disabled={disabled}
          aria-label="행 삭제"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
