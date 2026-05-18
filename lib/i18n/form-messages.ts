// 신청서 폼 (Live2DCommissionForm / IllustCommissionForm) 의 정적 텍스트 i18n.
//
// DB 가 아닌 코드에 매핑을 둔 이유:
//   - 라벨/placeholder/validation 등은 어드민이 수정할 일이 거의 없는 시스템 텍스트.
//   - fallback 인프라 불필요 — ko/en/jp 세 언어 모두 항상 채워져 있음.
//
// 추가 키는 FormMessages 타입에 먼저 등록 후 세 사전(KO/EN/JP) 모두에 값을 채워야
// 컴파일이 통과한다 (Record<Language, FormMessages>).

import type { Language } from "@/types/database";

export type FormMessages = {
  // 공통 라벨
  nickname: string;
  nickname_placeholder: string;
  contact: string;
  contact_placeholder: string;
  contact_help: string;
  desired_date: string;
  desired_date_placeholder: string;
  work_process_private: string;
  portfolio_private: string;
  no_preference: string;
  private_label: string;
  request_type: string;
  request_character: string;
  character_placeholder: string;
  image_attach: string;
  image_preview_alt: string;
  image_remove_aria: string;
  additional_notes: string;
  optional_label: string;
  submit: string;
  submitting: string;
  uploading_images: string;
  submit_error_generic: string;
  submit_error_upload_exception: string;
  submit_error_upload_partial: string;

  // 공지사항 동의 게이트
  pre_check_title: string;
  pre_check_desc: string;
  view_notice: string;
  notice_agree: string;

  // 신청 타입 옵션 — Live2D
  illust_only: string;
  illust_rigging: string;

  // 신청 타입 옵션 — Illust
  broadcast_bust: string;
  broadcast_half: string;
  broadcast_full: string;
  commercial_with_bg: string;
  commercial_without_bg: string;

  // Validation
  validation_nickname: string;
  validation_contact: string;
  validation_type: string;
  validation_character: string;
};

export const formMessages: Record<Language, FormMessages> = {
  ko: {
    nickname: "닉네임",
    nickname_placeholder: "닉네임을 입력해주세요",
    contact: "연락처",
    contact_placeholder: "예: @cho__913",
    contact_help:
      "이메일, X, 디스코드 등 빠른 연락이 가능한 연락처를 남겨주세요",
    desired_date: "수령 희망 날짜",
    desired_date_placeholder: "예: 3/15, 3-15 등",
    work_process_private: "작업과정 비공개",
    portfolio_private: "포트폴리오 비공개",
    no_preference: "상관없음",
    private_label: "비공개",
    request_type: "신청 타입",
    request_character: "신청 캐릭터",
    character_placeholder:
      "아직 정해지지 않았다면 대략적인 느낌이나 자료를 적어주세요",
    image_attach: "이미지 첨부",
    image_preview_alt: "첨부 미리보기",
    image_remove_aria: "첨부 이미지 제거",
    additional_notes: "추가사항",
    optional_label: "선택",
    submit: "제출",
    submitting: "제출 중...",
    uploading_images: "이미지 업로드 중...",
    submit_error_generic: "제출 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
    submit_error_upload_exception:
      "이미지 업로드 중 예외가 발생했어요. 잠시 후 다시 시도해 주세요.",
    submit_error_upload_partial:
      "이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.",

    pre_check_title: "신청 전 확인해주세요",
    pre_check_desc:
      "원활한 작업과 분쟁 방지를 위해, 신청 전 공지사항을 반드시 확인해주세요.",
    view_notice: "공지사항 보러 가기",
    notice_agree: "공지사항을 모두 확인했으며, 동의합니다",

    illust_only: "일러스트만",
    illust_rigging: "일러스트 + 리깅",

    broadcast_bust: "방송용 - 흉상",
    broadcast_half: "방송용 - 반신",
    broadcast_full: "방송용 - 전신",
    commercial_with_bg: "상업용 - 배경포함",
    commercial_without_bg: "상업용 - 미포함",

    validation_nickname: "닉네임을 입력해 주세요",
    validation_contact: "연락처를 입력해 주세요",
    validation_type: "신청 타입을 선택해 주세요",
    validation_character: "신청 캐릭터 정보를 입력해 주세요",
  },

  en: {
    nickname: "Nickname",
    nickname_placeholder: "Please enter your nickname",
    contact: "Contact",
    contact_placeholder: "e.g., @cho__913",
    contact_help:
      "Please leave a contact (email, X, Discord, etc.) where you can be reached quickly",
    desired_date: "Desired delivery date",
    desired_date_placeholder: "e.g., 3/15, 3-15",
    work_process_private: "Work process privacy",
    portfolio_private: "Portfolio privacy",
    no_preference: "No preference",
    private_label: "Private",
    request_type: "Request type",
    request_character: "Character",
    character_placeholder:
      "If undecided, please describe the general feel or share references",
    image_attach: "Attach images",
    image_preview_alt: "Attachment preview",
    image_remove_aria: "Remove attached image",
    additional_notes: "Additional notes",
    optional_label: "Optional",
    submit: "Submit",
    submitting: "Submitting...",
    uploading_images: "Uploading images...",
    submit_error_generic:
      "An error occurred while submitting. Please try again later.",
    submit_error_upload_exception:
      "An error occurred while uploading images. Please try again later.",
    submit_error_upload_partial:
      "Image upload failed. Please try again later.",

    pre_check_title: "Please check before applying",
    pre_check_desc:
      "To ensure smooth work and avoid disputes, please make sure to read the notice before applying.",
    view_notice: "View notice",
    notice_agree: "I have read and agree to all notices",

    illust_only: "Illustration only",
    illust_rigging: "Illustration + rigging",

    broadcast_bust: "Broadcasting - Bust",
    broadcast_half: "Broadcasting - Half body",
    broadcast_full: "Broadcasting - Full body",
    commercial_with_bg: "Commercial - With background",
    commercial_without_bg: "Commercial - Without background",

    validation_nickname: "Please enter your nickname",
    validation_contact: "Please enter your contact",
    validation_type: "Please select a request type",
    validation_character: "Please enter character information",
  },

  jp: {
    nickname: "ニックネーム",
    nickname_placeholder: "ニックネームを入力してください",
    contact: "連絡先",
    contact_placeholder: "例：@cho__913",
    contact_help:
      "メール、X、Discordなど、すぐに連絡できる連絡先をご記入ください",
    desired_date: "受取希望日",
    desired_date_placeholder: "例：3/15、3-15など",
    work_process_private: "制作過程の非公開",
    portfolio_private: "ポートフォリオの非公開",
    no_preference: "構いません",
    private_label: "非公開",
    request_type: "申請タイプ",
    request_character: "申請キャラクター",
    character_placeholder:
      "まだ決まっていない場合は、おおよその雰囲気や資料を記入してください",
    image_attach: "画像添付",
    image_preview_alt: "添付プレビュー",
    image_remove_aria: "添付画像を削除",
    additional_notes: "追加事項",
    optional_label: "任意",
    submit: "送信",
    submitting: "送信中...",
    uploading_images: "画像をアップロード中...",
    submit_error_generic:
      "送信中にエラーが発生しました。しばらくしてから再度お試しください。",
    submit_error_upload_exception:
      "画像のアップロード中にエラーが発生しました。しばらくしてから再度お試しください。",
    submit_error_upload_partial:
      "画像のアップロードに失敗しました。しばらくしてから再度お試しください。",

    pre_check_title: "申請前にご確認ください",
    pre_check_desc:
      "円滑な作業とトラブル防止のため、申請前に必ずお知らせをご確認ください。",
    view_notice: "お知らせを見る",
    notice_agree: "お知らせをすべて確認し、同意します",

    illust_only: "イラストのみ",
    illust_rigging: "イラスト＋リギング",

    broadcast_bust: "放送用 - バストアップ",
    broadcast_half: "放送用 - 半身",
    broadcast_full: "放送用 - 全身",
    commercial_with_bg: "商用 - 背景あり",
    commercial_without_bg: "商用 - 背景なし",

    validation_nickname: "ニックネームを入力してください",
    validation_contact: "連絡先を入力してください",
    validation_type: "申請タイプを選択してください",
    validation_character: "キャラクター情報を入力してください",
  },
};

export function getFormMessages(locale: Language): FormMessages {
  return formMessages[locale];
}
