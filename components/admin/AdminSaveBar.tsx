"use client";

import { useEffect, useState } from "react";

// 3개 어드민 매니저(NoticesManager / PricingManager / ProcessManager) 의 공통 하단
// 고정 저장 bar. 변경사항이 없으면 안 보이고, 있으면 하단에서 슬라이드업으로 등장.
//
// 이전엔 매니저마다 우상단에 "● 저장되지 않은 변경사항" 인디케이터 + 페이지 하단에
// "저장 (N)" 버튼이 따로 있었음. 이번 PR 에서 하나로 통합.

type Props = {
  dirtyCount: number;
  busy?: boolean;
  onSave: () => void | Promise<void>;
};

export default function AdminSaveBar({ dirtyCount, busy = false, onSave }: Props) {
  const visible = dirtyCount > 0;

  // 닫을 때 slide-down 애니메이션이 끝난 후 unmount — visible=false 직후 mount 유지.
  // CSS transition 만으로도 OK 지만, dirtyCount=0 이 되는 순간 텍스트가 "0개" 로
  // 깜빡이는 걸 막기 위해 last-visible-count 를 잠시 유지.
  const [renderCount, setRenderCount] = useState(dirtyCount);
  useEffect(() => {
    if (dirtyCount > 0) setRenderCount(dirtyCount);
  }, [dirtyCount]);

  return (
    <div
      className={`admin-save-bar${visible ? " is-visible" : ""}`}
      role="region"
      aria-label="저장 바"
      aria-hidden={!visible}
    >
      <div className="admin-save-bar-inner">
        <span className="admin-save-bar-msg">
          ● 저장되지 않은 변경사항 {renderCount}개
        </span>
        <button
          type="button"
          className="admin-action-btn admin-action-btn-primary"
          onClick={() => onSave()}
          disabled={busy || !visible}
        >
          {busy ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
