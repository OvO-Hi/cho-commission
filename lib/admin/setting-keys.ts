// settings 테이블의 메인 페이지용 키 컨벤션.
// 서버 컴포넌트와 클라이언트 컴포넌트 양쪽에서 안전하게 import 가능하도록
// 'use client' / 서버 의존성이 없는 단독 모듈로 분리합니다.
//
// 새 키 추가 시 여기에만 추가하면 어드민/사용자 페이지가 동일한 식별자를 공유합니다.
export const SETTING_KEYS = {
  intro: "intro_text",
  snsX: "sns_x",
  snsEmail: "sns_email",
} as const;
