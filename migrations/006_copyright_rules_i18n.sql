-- =====================================================================
-- 006_copyright_rules_i18n.sql
--
-- copyright_rules 의 행 라벨 다국어화. 기존 단일 `label` 컬럼 옆에
-- label_en / label_jp 컬럼을 추가하여 copyright_columns 와 동일한
-- 멀티컬럼 패턴으로 정렬.
--
-- 기존 `label` 컬럼은 ko 라벨 (NOT NULL) 으로 유지 — rename 시 어드민/
-- 사용자 페이지 코드 동시 수정이 필요한데 영향 범위 비해 이득 적음.
--
-- 적용
--   Supabase SQL Editor 에 통째로 붙여넣어 실행.
-- =====================================================================

BEGIN;

-- 1. 컬럼 추가 (TEXT, NULL 허용 — 어드민에서 EN/JP 입력 안 한 row 는 NULL).
ALTER TABLE copyright_rules
  ADD COLUMN IF NOT EXISTS label_en TEXT,
  ADD COLUMN IF NOT EXISTS label_jp TEXT;

-- 2. 시드 — DB 의 KO 라벨 ('방송용' / '상업용') 에 EN/JP 채우기.
UPDATE copyright_rules
  SET label_en = 'For Broadcasting', label_jp = '放送用'
  WHERE label = '방송용';

UPDATE copyright_rules
  SET label_en = 'For Commercial', label_jp = '商用'
  WHERE label = '상업용';

COMMIT;

-- =====================================================================
-- 검증 (마이그레이션 후 수동 실행)
--
--   SELECT id, order_num, label, label_en, label_jp FROM copyright_rules
--   ORDER BY order_num;
--
-- 기대:
--   order=1 | '방송용' | 'For Broadcasting' | '放送用'
--   order=2 | '상업용' | 'For Commercial'   | '商用'
-- =====================================================================
