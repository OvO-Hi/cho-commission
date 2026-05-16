// Supabase 테이블 스키마에 1:1 로 대응되는 타입 정의입니다.
// supabase-js 의 Generic 인자로 넘기면 .from('notices') 호출 시 자동 타입 추론을 받을 수 있습니다.

export type Language = "ko" | "en" | "jp";

export type CommissionCategory = "live2d" | "illust";

// 신청 폼의 "신청 타입" 라디오 옵션과 1:1 대응.
// Live2D / Illust 두 카테고리의 옵션을 한 union 으로 통합 관리합니다.
//  Live2D:
//    - illust              : 일러스트만
//    - both                : 일러스트 + 리깅
//  Illust:
//    - broadcast_bust      : 방송용 흉상
//    - broadcast_half      : 방송용 반신
//    - broadcast_full      : 방송용 전신
//    - commercial_with_bg  : 상업용 배경 포함
//    - commercial_no_bg    : 상업용 배경 미포함
export type ApplicationType =
  | "illust"
  | "both"
  | "broadcast_bust"
  | "broadcast_half"
  | "broadcast_full"
  | "commercial_with_bg"
  | "commercial_no_bg";

// notices 의 section 키. 새 섹션 추가 시 여기에 함께 등록해 다국어/렌더 순서를 한 곳에서 관리합니다.
export type NoticeSection = "intro" | "notice" | "guide" | "refund";

export type SampleBlockType = "text" | "youtube" | "image_row" | "divider";

// supabase-js GenericTable 의 Row 제약(Record<string, unknown>) 을 만족시키려면
// interface 가 아닌 type alias 를 사용해야 합니다(interface 는 암묵적 인덱스 시그니처가 없어
// .insert() 호출 시 values 파라미터가 'never' 로 좁혀짐).
export type Notice = {
  id: string;
  category: CommissionCategory | "common";
  section: NoticeSection | string;
  title: string;
  content: string;
  order_num: number;
  language: Language;
  created_at: string;
  updated_at: string;
}

export type ProcessStep = {
  id: string;
  category: CommissionCategory;
  step_num: number;
  title: string;
  // 단계 호버/탭 시 펼쳐지는 상세 설명. 리치 텍스트 HTML 또는 null/빈문자열.
  description: string | null;
  language: Language;
  created_at: string;
  updated_at: string;
}

export type PriceItem = {
  id: string;
  category: CommissionCategory;
  item_name: string;
  price: number;
  is_addon: boolean;
  description: string | null;
  // Illust 가격 그룹 구분용. Live2D 는 null. Illust 는 'broadcast' | 'commercial'.
  // is_addon=true 인 공통 추가금은 null.
  subcategory: string | null;
  // 추가금에서 "약 ~원" 표기 (UI 에서 가격 뒤에 "~" 붙임).
  is_approx: boolean;
  language: Language;
  order_num: number;
  created_at: string;
  updated_at: string;
}

export type Commission = {
  id: string;
  type: CommissionCategory;
  nickname: string;
  // contact 채널(이메일/디스코드/X DM 등). 실제 연락 수단을 받기 위해 nullable 텍스트로 추가.
  contact: string | null;
  desired_date: string | null;
  process_private: boolean;
  portfolio_private: boolean;
  application_type: ApplicationType;
  character_description: string;
  additional_notes: string | null;
  is_read: boolean;
  // 어드민이 정한 별칭. 신청자 닉네임 대신 목록/상세에서 빠르게 식별하기 위함.
  admin_label: string | null;
  // 어드민이 설정하는 마감일. 자유 텍스트(예: "5/13", "2026-05-13").
  deadline: string | null;
  // 첨부 이미지 공개 URL 배열. Supabase Storage 'commission-images' 버킷에 업로드된 파일들.
  image_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

export type Banner = {
  id: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 카테고리별 잔여 슬롯 관리. slot_number 는 고정 인덱스(1~N)로,
// is_filled 가 true 면 해당 슬롯은 신청을 받을 수 없습니다.
export type Slot = {
  id: string;
  category: CommissionCategory;
  slot_number: number;
  is_filled: boolean;
  created_at: string;
  updated_at: string;
}

// 사이트 전역 설정(공통 문구/약관 등). key 단위로 다국어 value 를 보관합니다.
export type Setting = {
  id: string;
  key: string;
  value: string;
  language: Language;
  updated_at: string;
}

// 카테고리 페이지의 샘플 영역. block_type 에 따라 사용하는 컬럼이 달라집니다.
//  - text       : text_content 사용
//  - youtube    : youtube_url 사용
//  - image_row  : sample_images 와 1:N 관계, row_height 로 가로 스트립 높이 지정
export type SampleBlock = {
  id: string;
  category: CommissionCategory;
  block_type: SampleBlockType;
  order_num: number;
  text_content: string | null;
  youtube_url: string | null;
  row_height: number | null;
  created_at: string;
  updated_at: string;
}

// Live2D "작업 타입 안내" 카드. 본문은 자식 테이블 live2d_type_items 의 label/value 행으로 구성.
export type Live2DType = {
  id: string;
  type_key: string;
  title: string;
  order_num: number;
  language: string;
  created_at: string;
  updated_at: string;
};

// 위 카드의 본문 항목. label 은 nullable (없으면 사용자 페이지에서 "·" 로 자리만 유지).
export type Live2DTypeItem = {
  id: string;
  type_id: string;
  label: string | null;
  value: string;
  order_num: number;
  created_at: string;
  updated_at: string;
};

// 저작권 범위 표 — Notice 페이지의 권한 매트릭스. id 는 정수 자동증가.
//
// 열 구조는 마이그레이션 001 로 정규화되어 copyright_columns / copyright_rule_values
// 로 분리됐다. 기존 boolean 컬럼들은 deprecated — 새 코드는 읽지/쓰지 않는다.
// (UI 전환 안정화 후 별도 PR 에서 DROP)
export type CopyrightRule = {
  id: number;
  label: string;
  /** @deprecated 마이그레이션 001 이후 copyright_rule_values 사용. 컬럼은 호환용으로만 잔존. */
  allow_personal: boolean;
  /** @deprecated */
  allow_sns: boolean;
  /** @deprecated */
  allow_broadcast: boolean;
  /** @deprecated */
  allow_youtube: boolean;
  /** @deprecated */
  allow_goods: boolean;
  order_num: number;
  created_at: string;
  updated_at: string;
};

// 저작권 범위 표의 열 — 한 row 가 한 열. label 은 ko 가 필수, en/jp 는 nullable.
// column_key 는 마이그레이션으로 시드된 기존 5개 열을 추적하기 위한 식별자.
// 어드민이 새로 추가하는 열은 column_key 가 null.
export type CopyrightColumn = {
  id: number;
  column_key: string | null;
  label_ko: string;
  label_en: string | null;
  label_jp: string | null;
  order_num: number;
  created_at: string;
  updated_at: string;
};

// 셀 값. (rule_id, column_id) 가 PK 라 ON DELETE CASCADE 로 자식이 자동 정리됨.
export type CopyrightRuleValue = {
  rule_id: number;
  column_id: number;
  checked: boolean;
};

export type SampleImage = {
  id: string;
  block_id: string;
  image_url: string;
  order_num: number;
  // 같은 row 안에서 다른 이미지와의 가로 너비 비율 (DB DEFAULT 1).
  width_ratio: number;
  created_at: string;
}

// supabase-js Generic 용 Database 타입.
// Insert / Update 는 자동 생성 컬럼(id, created_at 등)을 선택값으로 둡니다.
type Timestamps = "id" | "created_at" | "updated_at";

type InsertOf<T extends Record<Timestamps, unknown>> =
  Omit<T, Timestamps> & Partial<Pick<T, Timestamps>>;

type UpdateOf<T extends { id: unknown; created_at: unknown }> =
  Partial<Omit<T, "id" | "created_at">> & {
    updated_at?: string;
  };

// Setting / SampleImage 는 created_at 또는 updated_at 둘 중 하나만 있어
// 공용 헬퍼 대신 개별 Insert/Update 타입을 명시합니다.
type SettingInsert = Omit<Setting, "id" | "updated_at"> &
  Partial<Pick<Setting, "id" | "updated_at">>;
type SettingUpdate = Partial<Omit<Setting, "id">>;

type SampleImageInsert = Omit<SampleImage, "id" | "created_at"> &
  Partial<Pick<SampleImage, "id" | "created_at">>;
type SampleImageUpdate = Partial<Omit<SampleImage, "id" | "created_at">>;

// copyright_rule_values 는 (rule_id, column_id) 복합키라 InsertOf 패턴이 안 맞음.
// 둘 다 필수, checked 는 DEFAULT false 라 선택.
type CopyrightRuleValueInsert = {
  rule_id: number;
  column_id: number;
  checked?: boolean;
};
type CopyrightRuleValueUpdate = { checked?: boolean };

export type Database = {
  // supabase-js v2.74+ 가 schema 버전을 추적하기 위해 요구하는 메타 필드.
  // 누락 시 .insert() / .update() 의 values 파라미터가 'never' 로 좁혀져 컴파일 에러가 발생합니다.
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      notices: {
        Row: Notice;
        Insert: InsertOf<Notice>;
        Update: UpdateOf<Notice>;
        // postgrest-js GenericTable 가 Relationships 필드를 필수로 요구합니다.
        // FK 관계는 자동 생성 타입에서 채우는 부분이라, 수기 정의에서는 빈 배열로 둡니다.
        Relationships: [];
      };
      process_steps: {
        Row: ProcessStep;
        Insert: InsertOf<ProcessStep>;
        Update: UpdateOf<ProcessStep>;
        Relationships: [];
      };
      price_items: {
        Row: PriceItem;
        Insert: InsertOf<PriceItem>;
        Update: UpdateOf<PriceItem>;
        Relationships: [];
      };
      commissions: {
        Row: Commission;
        Insert: InsertOf<Commission>;
        Update: UpdateOf<Commission>;
        Relationships: [];
      };
      banners: {
        Row: Banner;
        Insert: InsertOf<Banner>;
        Update: UpdateOf<Banner>;
        Relationships: [];
      };
      slots: {
        Row: Slot;
        Insert: InsertOf<Slot>;
        Update: UpdateOf<Slot>;
        Relationships: [];
      };
      settings: {
        Row: Setting;
        Insert: SettingInsert;
        Update: SettingUpdate;
        Relationships: [];
      };
      sample_blocks: {
        Row: SampleBlock;
        Insert: InsertOf<SampleBlock>;
        Update: UpdateOf<SampleBlock>;
        Relationships: [];
      };
      sample_images: {
        Row: SampleImage;
        Insert: SampleImageInsert;
        Update: SampleImageUpdate;
        Relationships: [];
      };
      copyright_rules: {
        Row: CopyrightRule;
        Insert: InsertOf<CopyrightRule>;
        Update: UpdateOf<CopyrightRule>;
        Relationships: [];
      };
      copyright_columns: {
        Row: CopyrightColumn;
        Insert: InsertOf<CopyrightColumn>;
        Update: UpdateOf<CopyrightColumn>;
        Relationships: [];
      };
      copyright_rule_values: {
        Row: CopyrightRuleValue;
        Insert: CopyrightRuleValueInsert;
        Update: CopyrightRuleValueUpdate;
        Relationships: [];
      };
      live2d_types: {
        Row: Live2DType;
        Insert: InsertOf<Live2DType>;
        Update: UpdateOf<Live2DType>;
        Relationships: [];
      };
      live2d_type_items: {
        Row: Live2DTypeItem;
        Insert: InsertOf<Live2DTypeItem>;
        Update: UpdateOf<Live2DTypeItem>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
