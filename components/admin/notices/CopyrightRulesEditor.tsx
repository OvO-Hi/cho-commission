"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
import type {
  CopyrightColumn,
  CopyrightRule,
  CopyrightRuleValue,
} from "@/types/database";

const SAVE_DEBOUNCE_MS = 500;

type Props = {
  initialRules: CopyrightRule[];
  initialColumns: CopyrightColumn[];
  initialValues: CopyrightRuleValue[];
};

// 셀 lookup 키. (rule, column) 쌍을 한 문자열로 압축해서 Map 키로 사용.
function cellKey(ruleId: number, columnId: number) {
  return `${ruleId}:${columnId}`;
}

export default function CopyrightRulesEditor({
  initialRules,
  initialColumns,
  initialValues,
}: Props) {
  const router = useRouter();
  const notifier = useSaveStateNotifier();

  const [rules, setRules] = useState<CopyrightRule[]>(initialRules);
  const [columns, setColumns] = useState<CopyrightColumn[]>(initialColumns);
  const [valueMap, setValueMap] = useState<Map<string, boolean>>(() => {
    const m = new Map<string, boolean>();
    for (const v of initialValues) m.set(cellKey(v.rule_id, v.column_id), v.checked);
    return m;
  });
  const [busy, setBusy] = useState(false);

  // 서버 컴포넌트가 refresh 후 새 props 를 내려주면 다시 동기화.
  useEffect(() => setRules(initialRules), [initialRules]);
  useEffect(() => setColumns(initialColumns), [initialColumns]);
  useEffect(() => {
    const m = new Map<string, boolean>();
    for (const v of initialValues) m.set(cellKey(v.rule_id, v.column_id), v.checked);
    setValueMap(m);
  }, [initialValues]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.order_num - b.order_num),
    [rules],
  );
  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order_num - b.order_num),
    [columns],
  );

  // ─────────────────────────────────────────────────────────────────────
  // Rule (행) CRUD
  // ─────────────────────────────────────────────────────────────────────
  async function addRule() {
    if (busy) return;
    setBusy(true);
    notifier?.notifySaving();
    const max =
      rules.length === 0 ? -1 : Math.max(...rules.map((r) => r.order_num));
    const supabase = createClient();
    // deprecated boolean 컬럼들은 DB 가 NOT NULL DEFAULT false 라면 생략 가능하지만,
    // 명시 전달이 안전. 컬럼 DROP 후에는 이 라인 제거.
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
      console.error("[admin/notices/copyright] add rule failed:", error?.message);
      notifier?.notifyError();
      return;
    }
    setRules((prev) => [...prev, data]);
    notifier?.notifySaved();
    router.refresh();
  }

  async function deleteRule(id: number) {
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
      console.error("[admin/notices/copyright] delete rule failed:", error.message);
      notifier?.notifyError();
      return;
    }
    // ON DELETE CASCADE 가 copyright_rule_values 의 row 도 정리. 로컬도 같이 청소.
    setRules((prev) => prev.filter((r) => r.id !== id));
    setValueMap((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key.startsWith(`${id}:`)) next.delete(key);
      }
      return next;
    });
    notifier?.notifySaved();
    router.refresh();
  }

  async function updateRuleLabel(id: number, label: string) {
    notifier?.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("copyright_rules")
      .update({ label })
      .eq("id", id);
    if (error) {
      console.error("[admin/notices/copyright] update label failed:", error.message);
      notifier?.notifyError();
      return;
    }
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
    notifier?.notifySaved();
  }

  async function handleRulesDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedRules.findIndex((r) => r.id === active.id);
    const newIndex = sortedRules.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sortedRules, oldIndex, newIndex);
    setRules(reordered.map((r, i) => ({ ...r, order_num: i })));

    notifier?.notifySaving();
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((r, i) =>
        supabase
          .from("copyright_rules")
          .update({ order_num: i })
          .eq("id", r.id),
      ),
    );
    if (results.some((r) => r.error)) notifier?.notifyError();
    else notifier?.notifySaved();
    router.refresh();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Column (열) CRUD
  // ─────────────────────────────────────────────────────────────────────
  async function addColumn() {
    if (busy) return;
    setBusy(true);
    notifier?.notifySaving();
    const max =
      columns.length === 0 ? -1 : Math.max(...columns.map((c) => c.order_num));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("copyright_columns")
      .insert({
        // 마이그레이션으로 시드된 5개 열만 column_key 를 가짐.
        // 신규 열은 null — DB 가 정체성 추적을 안 한다.
        column_key: null,
        label_ko: "새 열",
        label_en: null,
        label_jp: null,
        order_num: max + 1,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      console.error("[admin/notices/copyright] add column failed:", error?.message);
      notifier?.notifyError();
      return;
    }
    setColumns((prev) => [...prev, data]);
    notifier?.notifySaved();
    router.refresh();
  }

  async function deleteColumn(id: number) {
    if (busy) return;
    if (!window.confirm("이 열을 삭제하면 모든 행의 해당 셀 값이 함께 사라집니다. 계속할까요?")) {
      return;
    }
    setBusy(true);
    notifier?.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("copyright_columns")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (error) {
      console.error("[admin/notices/copyright] delete column failed:", error.message);
      notifier?.notifyError();
      return;
    }
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setValueMap((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key.endsWith(`:${id}`)) next.delete(key);
      }
      return next;
    });
    notifier?.notifySaved();
    router.refresh();
  }

  async function updateColumnLabel(
    id: number,
    patch: { label_ko?: string; label_en?: string | null; label_jp?: string | null },
  ) {
    notifier?.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("copyright_columns")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[admin/notices/copyright] update column failed:", error.message);
      notifier?.notifyError();
      return;
    }
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    notifier?.notifySaved();
  }

  // ─────────────────────────────────────────────────────────────────────
  // 셀 토글 — (rule_id, column_id) upsert
  // ─────────────────────────────────────────────────────────────────────
  async function toggleCell(ruleId: number, columnId: number, next: boolean) {
    const key = cellKey(ruleId, columnId);
    // 낙관적 업데이트.
    setValueMap((prev) => {
      const m = new Map(prev);
      m.set(key, next);
      return m;
    });
    notifier?.notifySaving();
    const supabase = createClient();
    const { error } = await supabase
      .from("copyright_rule_values")
      .upsert(
        { rule_id: ruleId, column_id: columnId, checked: next },
        { onConflict: "rule_id,column_id" },
      );
    if (error) {
      console.error("[admin/notices/copyright] toggle cell failed:", error.message);
      notifier?.notifyError();
      // 롤백.
      setValueMap((prev) => {
        const m = new Map(prev);
        m.set(key, !next);
        return m;
      });
      return;
    }
    notifier?.notifySaved();
  }

  // ─────────────────────────────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="admin-copyright">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleRulesDragEnd}
      >
        <div className="admin-copyright-scroll">
          <table className="admin-copyright-table">
            <thead>
              <tr>
                <th aria-label="순서" className="admin-copyright-handle-col" />
                <th className="admin-copyright-label-col">라벨</th>
                {sortedColumns.map((col) => (
                  <ColumnHeader
                    key={col.id}
                    column={col}
                    onUpdate={(patch) => updateColumnLabel(col.id, patch)}
                    onDelete={() => deleteColumn(col.id)}
                    disabled={busy}
                  />
                ))}
                <th className="admin-copyright-addcol-col">
                  <button
                    type="button"
                    className="admin-copyright-addcol"
                    onClick={addColumn}
                    disabled={busy}
                    aria-label="열 추가"
                  >
                    + 열 추가
                  </button>
                </th>
                <th aria-label="행 삭제" className="admin-copyright-delete-col" />
              </tr>
            </thead>
            <SortableContext
              items={sortedRules.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {sortedRules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    columns={sortedColumns}
                    valueMap={valueMap}
                    onUpdateLabel={(label) => updateRuleLabel(rule.id, label)}
                    onDelete={() => deleteRule(rule.id)}
                    onToggleCell={(columnId, next) =>
                      toggleCell(rule.id, columnId, next)
                    }
                    disabled={busy}
                  />
                ))}
                {sortedRules.length === 0 && (
                  <tr>
                    <td
                      colSpan={2 + sortedColumns.length + 2}
                      className="admin-copyright-empty"
                    >
                      행이 없어요. 아래 + 행 추가 로 첫 행을 만들어 보세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>

      <button
        type="button"
        className="admin-copyright-add"
        onClick={addRule}
        disabled={busy}
      >
        + 행 추가
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 헤더 셀 — ko 인라인 입력 + 🌐 팝오버(en/jp) + X 삭제
// ─────────────────────────────────────────────────────────────────────────
function ColumnHeader({
  column,
  onUpdate,
  onDelete,
  disabled,
}: {
  column: CopyrightColumn;
  onUpdate: (patch: {
    label_ko?: string;
    label_en?: string | null;
    label_jp?: string | null;
  }) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [labelKo, setLabelKo] = useState(column.label_ko);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLabelKo(column.label_ko), [column.id, column.label_ko]);

  // 팝오버 외부 클릭 / ESC 로 닫기.
  useEffect(() => {
    if (!popoverOpen) return;
    function onPointer(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) setPopoverOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoverOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen]);

  function scheduleKoSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (next !== column.label_ko) onUpdate({ label_ko: next });
    }, SAVE_DEBOUNCE_MS);
  }

  return (
    <th className="admin-copyright-col-header">
      <div className="admin-copyright-col-header-row">
        <input
          type="text"
          className="admin-copyright-col-input"
          value={labelKo}
          placeholder="열 이름"
          onChange={(e) => {
            setLabelKo(e.target.value);
            scheduleKoSave(e.target.value);
          }}
          onBlur={() => {
            if (debounceRef.current) {
              clearTimeout(debounceRef.current);
              debounceRef.current = null;
              if (labelKo !== column.label_ko) onUpdate({ label_ko: labelKo });
            }
          }}
          disabled={disabled}
          aria-label="열 이름 (한국어)"
        />
        <div className="admin-copyright-col-actions">
          <button
            type="button"
            className="admin-copyright-col-i18n"
            onClick={() => setPopoverOpen((v) => !v)}
            aria-label="다국어 라벨 편집"
            aria-expanded={popoverOpen}
            disabled={disabled}
          >
            <span aria-hidden="true">🌐</span>
          </button>
          <button
            type="button"
            className="admin-copyright-col-delete"
            onClick={onDelete}
            disabled={disabled}
            aria-label="열 삭제"
          >
            ✕
          </button>
        </div>
      </div>

      {popoverOpen && (
        <div
          ref={popoverRef}
          className="admin-copyright-col-popover"
          role="dialog"
          aria-label="다국어 라벨"
        >
          <I18nField
            label="English"
            initial={column.label_en ?? ""}
            onCommit={(v) =>
              onUpdate({ label_en: v.trim() === "" ? null : v })
            }
            disabled={disabled}
          />
          <I18nField
            label="日本語"
            initial={column.label_jp ?? ""}
            onCommit={(v) =>
              onUpdate({ label_jp: v.trim() === "" ? null : v })
            }
            disabled={disabled}
          />
          <p className="admin-copyright-col-popover-hint">
            비워두면 사용자 페이지에서 한국어 라벨로 대체됩니다.
          </p>
        </div>
      )}
    </th>
  );
}

// 팝오버 내부 입력 — onBlur 또는 디바운스로 commit.
function I18nField({
  label,
  initial,
  onCommit,
  disabled,
}: {
  label: string;
  initial: string;
  onCommit: (value: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(initial), [initial]);

  function schedule(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (next !== initial) onCommit(next);
    }, SAVE_DEBOUNCE_MS);
  }

  return (
    <label className="admin-copyright-col-popover-field">
      <span className="admin-copyright-col-popover-label">{label}</span>
      <input
        type="text"
        className="admin-form-input"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          schedule(e.target.value);
        }}
        onBlur={() => {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
            if (value !== initial) onCommit(value);
          }
        }}
        disabled={disabled}
      />
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 행 — 라벨 input + 동적 셀들
// ─────────────────────────────────────────────────────────────────────────
function RuleRow({
  rule,
  columns,
  valueMap,
  onUpdateLabel,
  onDelete,
  onToggleCell,
  disabled,
}: {
  rule: CopyrightRule;
  columns: CopyrightColumn[];
  valueMap: Map<string, boolean>;
  onUpdateLabel: (label: string) => void;
  onDelete: () => void;
  onToggleCell: (columnId: number, next: boolean) => void;
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

  useEffect(() => setLabel(rule.label), [rule.id, rule.label]);

  function scheduleLabelSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (next !== rule.label) onUpdateLabel(next);
    }, SAVE_DEBOUNCE_MS);
  }

  const style: CSSProperties = {
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
      <td className="admin-copyright-label-col">
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
              if (label !== rule.label) onUpdateLabel(label);
            }
          }}
          disabled={disabled}
        />
      </td>
      {columns.map((c) => {
        const checked = valueMap.get(cellKey(rule.id, c.id)) ?? false;
        return (
          <td key={c.id} className="admin-copyright-check-cell">
            <input
              type="checkbox"
              className="admin-copyright-check"
              checked={checked}
              onChange={(e) => onToggleCell(c.id, e.target.checked)}
              disabled={disabled}
              aria-label={c.label_ko}
            />
          </td>
        );
      })}
      {/* + 열 추가 컬럼 자리에 빈 셀 — 헤더의 버튼과 정렬 맞추기 위함 */}
      <td className="admin-copyright-addcol-col" aria-hidden />
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
