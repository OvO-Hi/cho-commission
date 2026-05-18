// 사용자 페이지 (Live2D / Illust / Notice / Sample) 와 공통 UI 칩(BackToTop /
// CommissionFormCTA / "← 메인으로") 의 정적 텍스트 i18n.
//
// 폼 전용 매핑(form-messages.ts) 과 분리해 도메인별로 정리. fallback 인프라 불필요
// — ko/en/jp 세 언어 모두 항상 채워져 있음.
//
// 가격/공지/작업 과정 등 어드민이 DB 에서 관리하는 텍스트는 여기 들어오지 않는다.
// (해당 텍스트는 row-per-language 패턴 + fetchListWithFallback 으로 처리.)

import type { Language } from "@/types/database";

export type PageMessages = {
  // 공통 chrome
  back_to_main: string;
  back_to_main_aria: string;
  back_to_apply: string;
  back_to_apply_aria: string;
  top_button_text: string;
  top_button_aria: string;
  form_cta_text: string;
  form_cta_aria: string;

  // 페이지 부제목
  live2d_subtitle: string;
  illust_subtitle: string;
  notice_subtitle: string;

  // 샘플 CTA / 슬롯
  view_samples: string;
  available_slots: string;
  slot_status_list_aria: string;
  slot_open: string;
  slot_closed: string;

  // 섹션 헤더 (Live2D / Illust 공유)
  section_process: string;
  section_type: string;
  section_price: string;
  section_form: string;

  // 안내/빈상태
  process_revision_note: string;
  price_preparing: string;
  status_closed: string;
  status_no_slots: string;
  status_all_filled: string;

  // Notice 섹션 헤더
  notice_section_intro: string;
  notice_section_notice: string;
  notice_section_copyright: string;
  notice_section_refund: string;
  notice_empty: string;
  notice_apply_live2d: string;
  notice_apply_illust: string;
  notice_cell_yes_aria: string;
  notice_cell_no_aria: string;

  // 샘플 페이지
  live2d_sample_title: string;
  illust_sample_title: string;

  // 제출 완료 페이지
  submission_complete_title: string;
  submission_complete_sub: string;
  submission_title: string;
  attached_images_label: string;
};

export const pageMessages: Record<Language, PageMessages> = {
  ko: {
    back_to_main: "← 메인으로",
    back_to_main_aria: "메인으로 돌아가기",
    back_to_apply: "← 신청 페이지로 돌아가기",
    back_to_apply_aria: "신청 페이지로 돌아가기",
    top_button_text: "TOP",
    top_button_aria: "맨 위로",
    form_cta_text: "📝 신청서 작성하기 ↓",
    form_cta_aria: "신청서로 이동",

    live2d_subtitle: "버츄얼 리깅 커미션 안내",
    illust_subtitle: "일러스트 커미션 안내",
    notice_subtitle: "커미션 신청 전 꼭 확인해 주세요.",

    view_samples: "샘플 보러가기 →",
    available_slots: "신청 가능 슬롯",
    slot_status_list_aria: "신청 가능 슬롯 현황",
    slot_open: "모집중",
    slot_closed: "닫힘",

    section_process: "작업 과정",
    section_type: "작업 타입 안내",
    section_price: "가격 안내",
    section_form: "신청서 작성",

    process_revision_note: "* 총 2회 수정이 가능하니 참고해주시길 바랍니다.",
    price_preparing: "가격 정보가 준비 중입니다.",
    status_closed: "지금은 신청을 받고 있지 않아요",
    status_no_slots: "모집중인 슬롯이 없어요",
    status_all_filled: "모든 슬롯이 마감되었어요",

    notice_section_intro: "자기소개",
    notice_section_notice: "공지사항",
    notice_section_copyright: "저작권 범위",
    notice_section_refund: "환불 안내",
    notice_empty: "준비 중입니다.",
    notice_apply_live2d: "Live2D 신청하기",
    notice_apply_illust: "Illust 신청하기",
    notice_cell_yes_aria: "허용",
    notice_cell_no_aria: "불가",

    live2d_sample_title: "Live2D 샘플",
    illust_sample_title: "Illust 샘플",

    submission_complete_title: "제출이 완료되었습니다",
    submission_complete_sub:
      "빠른 시일 내에 적어주신 연락처로 답변드리겠습니다",
    submission_title: "신청 내역",
    attached_images_label: "첨부 이미지",
  },

  en: {
    back_to_main: "← Back to home",
    back_to_main_aria: "Back to home",
    back_to_apply: "← Back to application",
    back_to_apply_aria: "Back to application",
    top_button_text: "TOP",
    top_button_aria: "Back to top",
    form_cta_text: "📝 Fill out application ↓",
    form_cta_aria: "Go to application form",

    live2d_subtitle: "Virtual rigging commission",
    illust_subtitle: "Illustration commission",
    notice_subtitle: "Please read before applying.",

    view_samples: "View samples →",
    available_slots: "Available slots",
    slot_status_list_aria: "Slot availability",
    slot_open: "Open",
    slot_closed: "Closed",

    section_process: "Work process",
    section_type: "Work types",
    section_price: "Prices",
    section_form: "Application form",

    process_revision_note:
      "* Please note that revisions are possible up to 2 times.",
    price_preparing: "Price information is being prepared.",
    status_closed: "We are not accepting applications at the moment.",
    status_no_slots: "There are no open slots.",
    status_all_filled: "All slots are filled.",

    notice_section_intro: "About",
    notice_section_notice: "Notice",
    notice_section_copyright: "Copyright scope",
    notice_section_refund: "Refund policy",
    notice_empty: "Coming soon.",
    notice_apply_live2d: "Apply for Live2D",
    notice_apply_illust: "Apply for Illust",
    notice_cell_yes_aria: "Allowed",
    notice_cell_no_aria: "Not allowed",

    live2d_sample_title: "Live2D Samples",
    illust_sample_title: "Illust Samples",

    submission_complete_title: "Your application has been submitted",
    submission_complete_sub:
      "We will get back to you at the contact you provided as soon as possible.",
    submission_title: "Submission details",
    attached_images_label: "Attached images",
  },

  jp: {
    back_to_main: "← トップへ戻る",
    back_to_main_aria: "トップへ戻る",
    back_to_apply: "← 申請ページへ戻る",
    back_to_apply_aria: "申請ページへ戻る",
    top_button_text: "TOP",
    top_button_aria: "ページ上部へ",
    form_cta_text: "📝 申請フォームへ ↓",
    form_cta_aria: "申請フォームへ移動",

    live2d_subtitle: "バーチャルリギングのご依頼",
    illust_subtitle: "イラスト依頼のご案内",
    notice_subtitle: "申請前に必ずご確認ください。",

    view_samples: "サンプルを見る →",
    available_slots: "受付可能スロット",
    slot_status_list_aria: "受付可能スロットの状況",
    slot_open: "受付中",
    slot_closed: "受付終了",

    section_process: "制作の流れ",
    section_type: "プラン詳細",
    section_price: "料金",
    section_form: "申請フォーム",

    process_revision_note: "* 修正は合計2回まで可能ですのでご参考ください。",
    price_preparing: "料金情報は準備中です。",
    status_closed: "現在、申請を受け付けておりません。",
    status_no_slots: "受付中のスロットがありません。",
    status_all_filled: "すべてのスロットが埋まりました。",

    notice_section_intro: "自己紹介",
    notice_section_notice: "お知らせ",
    notice_section_copyright: "著作権の範囲",
    notice_section_refund: "返金について",
    notice_empty: "準備中です。",
    notice_apply_live2d: "Live2Dに申請する",
    notice_apply_illust: "イラストに申請する",
    notice_cell_yes_aria: "可",
    notice_cell_no_aria: "不可",

    live2d_sample_title: "Live2Dサンプル",
    illust_sample_title: "イラストサンプル",

    submission_complete_title: "申請が完了しました",
    submission_complete_sub:
      "ご記入いただいた連絡先に、できるだけ早くご連絡いたします。",
    submission_title: "申請内容",
    attached_images_label: "添付画像",
  },
};

export function getPageMessages(locale: Language): PageMessages {
  return pageMessages[locale];
}

// 슬롯 개수 뱃지 — locale 마다 단위가 달라 (KO "2개" / EN "2" / JP "2件") 헬퍼로 캡슐화.
export function formatSlotCount(locale: Language, n: number): string {
  if (locale === "ko") return `${n}개`;
  if (locale === "jp") return `${n}件`;
  return `${n}`;
}

// 개별 슬롯 aria-label — locale 마다 형식과 콜론이 다름.
//   KO: "슬롯 1: 모집중"
//   EN: "Slot 1: Open"
//   JP: "スロット1：受付中"
export function formatSlotItemAria(
  locale: Language,
  n: number,
  filled: boolean,
): string {
  const m = getPageMessages(locale);
  const status = filled ? m.slot_closed : m.slot_open;
  if (locale === "ko") return `슬롯 ${n}: ${status}`;
  if (locale === "jp") return `スロット${n}：${status}`;
  return `Slot ${n}: ${status}`;
}

// 첨부 이미지 alt — heading 은 복수형("Attached images") 이지만 alt 는 단수형이
// 자연스러워 별도 처리. KO/JP 는 단·복수 구분이 없어 heading 라벨과 같은 어휘 사용.
//   KO: "첨부 이미지 1"
//   EN: "Attached image 1"
//   JP: "添付画像 1"
export function formatAttachmentAlt(locale: Language, n: number): string {
  if (locale === "en") return `Attached image ${n}`;
  const m = getPageMessages(locale);
  return `${m.attached_images_label} ${n}`;
}
