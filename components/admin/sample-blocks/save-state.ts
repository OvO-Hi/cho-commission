"use client";

import { createContext, useContext } from "react";

// 자동 저장 인디케이터의 상태와 알림 함수.
// SamplesManager 가 실제 state 를 보유하고, 각 에디터/이미지/순서 변경 등이
// notifier 를 통해 'saving'→'saved'/'error' 로 신호를 보냅니다.
export type SaveStateNotifier = {
  notifySaving: () => void;
  notifySaved: () => void;
  notifyError: () => void;
};

export const SaveStateContext = createContext<SaveStateNotifier | null>(null);

export function useSaveStateNotifier(): SaveStateNotifier | null {
  return useContext(SaveStateContext);
}
