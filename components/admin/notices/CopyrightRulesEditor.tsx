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
  Language,
} from "@/types/database";

const SAVE_DEBOUNCE_MS = 500;

type Props = {
  initialRules: CopyrightRule[];
  initialColumns: CopyrightColumn[];
  initialValues: CopyrightRuleValue[];
  // 어드민 사이드바의 LanguageToggle 로 정해지는 현재 편집 언어.
  // copyright_columns 는 label_ko/en/jp 한 row 통합 패턴이라 이 prop 으로
  // 어느 컬럼을 편집할지만 결정.
  locale: Language;
};

// 현재 locale 에서 column 라벨이 들어있는 컬럼명.
function localeLabelColumn(
  locale: Language,
): "label_ko" | "label_en" | "label_jp" {
  if (locale === "en") return "label_en";
  if (locale === "jp") return "label_jp";
  return "label_ko";
}

// 셀 lookup 키. (rule, column) 쌍을 한 문자열로 압축해서 Map 키로 사용.
function cellKey(ruleId: number, columnId: number) {
  return `${ruleId}:${columnId}`;
}

export default function CopyrightRulesEditor({
  initialRules,
  initialColumns,
  initialValues,
  locale,
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
      // Array.from 으로 키 스냅샷 떠서 순회 — tsconfig target 이 ES5 라서
      // Map iterator 직접 for...of 가 컴파일 에러(downlevelIteration 미사용).
      for (const key of Array.from(next.keys())) {
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
    // label_ko 가 NOT NULL 이라 항상 채움. 현재 탭 언어의 label 도 같은 값으로
    // 초기화 — 어드민이 각 탭에서 따로 수정 가능.
    const defaultLabel = "새 열";
    const insertPayload: {
      column_key: null;
      label_ko: string;
      label_en: string | null;
      label_jp: string | null;
      order_num: number;
    } = {
      column_key: null,
      label_ko: defaultLabel,
      label_en: locale === "en" ? defaultLabel : null,
      label_jp: locale === "jp" ? defaultLabel : null,
      order_num: max + 1,
    };
    const { data, error } = await supabase
      .from("copyright_columns")
      .insert(insertPayload)
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
      // 위 deleteRule 과 동일 — Map iterator → Array.from 우회.
      for (const key of Array.from(next.keys())) {
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
                    locale={locale}
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
// 헤더 셀 — 현재 locale 의 label 인라인 편집 + X 삭제.
// (Phase 2 이전엔 🌐 팝오버에서 en/jp 를 별도 편집했지만, 사이드바 LanguageToggle
//  이 탭 역할을 하므로 팝오버 제거.)
// ─────────────────────────────────────────────────────────────────────────
function ColumnHeader({
  column,
  locale,
  onUpdate,
  onDelete,
  disabled,
}: {
  column: CopyrightColumn;
  locale: Language;
  onUpdate: (patch: {
    label_ko?: string;
    label_en?: string | null;
    label_jp?: string | null;
  }) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const labelCol = localeLabelColumn(locale);
  // ko 는 NOT NULL 이라 string, en/jp 는 nullable. 빈 문자열로 통일해 input 에 표시.
  const initialLabel = column[labelCol] ?? "";
  const [label, setLabel] = useState(initialLabel);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLabel(initialLabel), [column.id, initialLabel]);

  function commit(next: string) {
    // en/jp 의 경우 빈 문자열은 null 로 저장 (사용자 페이지가 ko 로 fallback 하도록).
    // ko 는 NOT NULL 이므로 빈 값을 그대로 보내면 DB 가 거부 — 사용자가 빈 값으로
    // 두려는 경우 어쩔 수 없이 그대로 보냄(DB 에러로 표시 됨).
    if (labelCol === "label_ko") {
      onUpdate({ label_ko: next });
    } else if (labelCol === "label_en") {
      onUpdate({ label_en: next.trim() === "" ? null : next });
    } else {
      onUpdate({ label_jp: next.trim() === "" ? null : next });
    }
  }

  function scheduleSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (next !== initialLabel) commit(next);
    }, SAVE_DEBOUNCE_MS);
  }

  return (
    <th className="admin-copyright-col-header">
      <div className="admin-copyright-col-header-row">
        <input
          type="text"
          className="admin-copyright-col-input"
          value={label}
          placeholder="열 이름"
          onChange={(e) => {
            setLabel(e.target.value);
            scheduleSave(e.target.value);
          }}
          onBlur={() => {
            if (debounceRef.current) {
              clearTimeout(debounceRef.current);
              debounceRef.current = null;
              if (label !== initialLabel) commit(label);
            }
          }}
          disabled={disabled}
          aria-label={`열 이름 (${locale.toUpperCase()})`}
        />
        <div className="admin-copyright-col-actions">
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
    </th>
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
