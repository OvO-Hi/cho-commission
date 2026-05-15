"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Commission } from "@/types/database";

import CommissionDetailModal from "./CommissionDetailModal";
import {
  APPLICATION_LABELS,
  TYPE_LABELS,
  formatCommissionDate,
} from "./commissionLabels";

type Filter = "all" | "live2d" | "illust" | "unread";

const FILTER_TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "live2d", label: "Live2D" },
  { id: "illust", label: "Illust" },
  { id: "unread", label: "미읽음만" },
];

export default function CommissionsList({
  initial,
}: {
  initial: Commission[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Commission[]>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 서버 페이지가 router.refresh() 로 재요청되면 새 initial 이 들어오므로 동기화.
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const filtered = useMemo(() => {
    let result = items;

    if (filter === "live2d") result = result.filter((c) => c.type === "live2d");
    else if (filter === "illust")
      result = result.filter((c) => c.type === "illust");
    else if (filter === "unread") result = result.filter((c) => !c.is_read);

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.nickname.toLowerCase().includes(q) ||
          (c.admin_label?.toLowerCase().includes(q) ?? false),
      );
    }

    return result;
  }, [items, filter, search]);

  const totalCount = items.length;
  const unreadCount = items.filter((c) => !c.is_read).length;

  const selected = selectedId
    ? items.find((c) => c.id === selectedId) ?? null
    : null;

  function handleUpdate(updated: Commission) {
    setItems((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );
    // 서버 캐시도 무효화해 다른 곳(슬롯 카운트 등) 에서도 최신값을 보도록.
    router.refresh();
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((c) => c.id !== id));
    setSelectedId(null);
    router.refresh();
  }

  return (
    <div className="admin-main-card admin-commissions">
      <header className="admin-commissions-header">
        <div>
          <h1 className="admin-main-title">커미션 신청 관리</h1>
          <p className="admin-commissions-summary">
            총 {totalCount}건{" "}
            <span className="admin-commissions-summary-unread">
              (미읽음 {unreadCount}건)
            </span>
          </p>
        </div>
      </header>

      <div className="admin-commissions-toolbar">
        <div className="admin-commissions-tabs" role="tablist">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`admin-commissions-tab${filter === tab.id ? " admin-commissions-tab-active" : ""}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="admin-commissions-search"
          placeholder="닉네임 / 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="admin-commissions-empty">
          {items.length === 0
            ? "아직 받은 신청이 없어요"
            : "조건에 맞는 신청이 없어요"}
        </p>
      ) : (
        <table className="admin-commissions-table">
          <thead>
            <tr>
              <th aria-label="읽음 여부" />
              <th>이름</th>
              <th>타입</th>
              <th>신청 타입</th>
              <th>받은 날짜</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className={`admin-commissions-row${c.is_read ? "" : " admin-commissions-row-unread"}`}
                onClick={() => setSelectedId(c.id)}
              >
                <td className="admin-commissions-dot-col">
                  {!c.is_read && (
                    <span
                      className="admin-commissions-unread-dot"
                      aria-label="미읽음"
                    />
                  )}
                </td>
                <td>
                  {c.admin_label ? (
                    <>
                      {c.admin_label}
                      {c.deadline && (
                        <span className="admin-commissions-deadline">
                          {" "}
                          / {c.deadline}까지
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="admin-commissions-nickname-only">
                      {c.nickname}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`admin-type-badge admin-type-${c.type}`}>
                    {TYPE_LABELS[c.type]}
                  </span>
                </td>
                <td>{APPLICATION_LABELS[c.application_type] ?? "—"}</td>
                <td className="admin-commissions-date-col">
                  {formatCommissionDate(c.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <CommissionDetailModal
          commission={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
