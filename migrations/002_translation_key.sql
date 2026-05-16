-- =====================================================================
-- 002_translation_key.sql
--
-- Phase 2 — 어드민 다국어 입력 인프라.
-- 같은 의미를 가진 ko/en/jp row 를 묶기 위해 translation_key uuid 컬럼을 도입.
--
-- 대상 테이블 (language 컬럼 있고 row-per-language 패턴):
--   settings, notices, process_steps, price_items, live2d_types
--
-- 제외:
--   - live2d_type_items : language 컬럼 없음 (부모 live2d_types 의 FK 만), 부모를 따라감
--   - copyright_columns : 이미 label_ko/en/jp 한 row 통합 패턴
--   - banners, slots, commissions, copyright_rules, copyright_rule_values, sample_*
--     : language 없음
--
-- 안전 원칙
--   1) Idempotent — ADD COLUMN IF NOT EXISTS / WHERE col IS NULL / DROP CONSTRAINT IF EXISTS
--   2) Loss-prevention — 기존 row 데이터 손실 없음. ko row 들에 UUID 만 채움
--   3) Non-destructive — RLS / 다른 컬럼 / 인덱스 손 안 댐
--   4) 한 트랜잭션 — 도중 실패 시 ROLLBACK
--
-- translation_key 의미
--   같은 의미의 항목 (예: "신청 안내 인트로 문구") 을 가리키는 그룹 식별자.
--   ko/en/jp row 가 같은 translation_key 를 공유하면 "번역 쌍" 으로 간주.
--   마이그레이션 시점에는 기존 ko row 마다 별개 UUID 가 부여되므로,
--   "현재 어드민에 들어 있는 ko 텍스트들이 각각 하나의 번역 그룹" 으로 시작.
--
-- 실행
--   Supabase 콘솔 → SQL Editor 에 전체 붙여넣어 실행. 끝.
-- =====================================================================

BEGIN;

-- gen_random_uuid() 의존 (Supabase 기본 활성화이지만 안전 차원).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 헬퍼: 한 테이블에 translation_key 추가 + 시드 + UNIQUE 제약을
-- 한 블록으로 처리하기 위해 anonymous DO 블록 사용. PL/pgSQL 변수로 테이블명을 받음.
--
-- 흐름:
--   1) ADD COLUMN IF NOT EXISTS translation_key uuid
--   2) NULL 인 row 에 gen_random_uuid() 부여 (재실행 안전 — 이미 채워진 건 건드리지 않음)
--   3) NOT NULL 로 변경 (이미 NOT NULL 이어도 idempotent)
--   4) UNIQUE(translation_key, language) 제약 (DROP IF EXISTS → ADD)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['settings','notices','process_steps','price_items','live2d_types'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- 1) ADD COLUMN IF NOT EXISTS
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS translation_key uuid',
      tbl
    );

    -- 2) NULL 인 row 에만 UUID 부여 — 재실행 시에도 기존 값 보존
    EXECUTE format(
      'UPDATE %I SET translation_key = gen_random_uuid() WHERE translation_key IS NULL',
      tbl
    );

    -- 3) NOT NULL 강제 (이미 NOT NULL 이어도 PG 는 같은 상태 유지)
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN translation_key SET NOT NULL',
      tbl
    );

    -- 4) UNIQUE(translation_key, language) — 같은 번역 그룹에 같은 언어 중복 방지
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      tbl, tbl || '_translation_key_language_key'
    );
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (translation_key, language)',
      tbl, tbl || '_translation_key_language_key'
    );
  END LOOP;
END $$;

COMMIT;

-- =====================================================================
-- 검증 쿼리 (마이그레이션 후 수동 실행 권장)
--
-- 1) 5개 테이블 전부 translation_key 가 NOT NULL 이고 row 마다 채워졌는지
--   SELECT 'settings'       AS tbl, count(*) FILTER (WHERE translation_key IS NULL) AS nulls FROM settings
--   UNION ALL SELECT 'notices',       count(*) FILTER (WHERE translation_key IS NULL) FROM notices
--   UNION ALL SELECT 'process_steps', count(*) FILTER (WHERE translation_key IS NULL) FROM process_steps
--   UNION ALL SELECT 'price_items',   count(*) FILTER (WHERE translation_key IS NULL) FROM price_items
--   UNION ALL SELECT 'live2d_types',  count(*) FILTER (WHERE translation_key IS NULL) FROM live2d_types;
--   --> 모든 nulls 가 0 이어야 함.
--
-- 2) UNIQUE 제약이 잘 걸렸는지 (한 그룹 + 한 언어 = 1 row)
--   SELECT translation_key, language, count(*)
--   FROM settings GROUP BY 1,2 HAVING count(*) > 1;
--   --> 빈 결과여야 함. 다른 4개 테이블도 동일하게 확인.
--
-- 롤백
--   BEGIN;
--   ALTER TABLE settings       DROP CONSTRAINT IF EXISTS settings_translation_key_language_key;
--   ALTER TABLE notices        DROP CONSTRAINT IF EXISTS notices_translation_key_language_key;
--   ALTER TABLE process_steps  DROP CONSTRAINT IF EXISTS process_steps_translation_key_language_key;
--   ALTER TABLE price_items    DROP CONSTRAINT IF EXISTS price_items_translation_key_language_key;
--   ALTER TABLE live2d_types   DROP CONSTRAINT IF EXISTS live2d_types_translation_key_language_key;
--   ALTER TABLE settings       DROP COLUMN IF EXISTS translation_key;
--   ALTER TABLE notices        DROP COLUMN IF EXISTS translation_key;
--   ALTER TABLE process_steps  DROP COLUMN IF EXISTS translation_key;
--   ALTER TABLE price_items    DROP COLUMN IF EXISTS translation_key;
--   ALTER TABLE live2d_types   DROP COLUMN IF EXISTS translation_key;
--   COMMIT;
-- =====================================================================
