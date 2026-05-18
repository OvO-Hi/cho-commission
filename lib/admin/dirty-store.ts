// 어드민 매니저가 자신의 dirty 상태와 저장 콜백을 window 에 등록하면,
// AdminSidebar 가 사이드바 메뉴 클릭 시 이 store 를 읽어 navigation guard 모달을 띄운다.
//
// React Context 대신 window 글로벌을 쓰는 이유: layout 이 server component 라
// AdminSidebar(client) 와 매니저(client) 가 형제 관계가 아니라 children prop 으로
// 끼워져 있다. Context Provider 를 끼우려면 ClientLayoutShell 같은 wrapper 가 또
// 필요해서 단순함을 우선. window 글로벌은 명세에 "복잡하면 단순하게" 라고 명시된 옵션.

export type DirtyState = {
  count: number;
  /** 저장 핸들러. 성공/실패와 무관하게 resolve 되면 다음 navigation 진행. */
  save: () => Promise<void>;
};

declare global {
  // eslint-disable-next-line no-var
  var __adminDirty: DirtyState | null | undefined;
}

export function setDirtyState(state: DirtyState | null): void {
  if (typeof window === "undefined") return;
  globalThis.__adminDirty = state;
}

export function getDirtyState(): DirtyState | null {
  if (typeof window === "undefined") return null;
  return globalThis.__adminDirty ?? null;
}
