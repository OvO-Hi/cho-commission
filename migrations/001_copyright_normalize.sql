-- =====================================================================
-- 001_copyright_normalize.sql
--
-- "저작권 범위" 표 (copyright_rules) 를 정규화하는 마이그레이션.
-- 기존: 열이 boolean 컬럼으로 박혀 있어 어드민에서 열을 추가/삭제할 수 없었음.
-- 변경: 열 = copyright_columns row, 셀 = copyright_rule_values row.
--
-- 안전 원칙
--   1) Idempotent — 여러 번 실행해도 같은 결과. CREATE TABLE IF NOT EXISTS,
--      INSERT ... ON CONFLICT DO NOTHING, DROP POLICY IF EXISTS 사용.
--   2) Non-destructive — 기존 boolean 컬럼(allow_personal 등) 은 DROP 하지 않음.
--      UI 전환이 안정화된 뒤 별도 PR 에서 정리.
--   3) Loss-prevention — 기존 데이터(N rules × 5 columns) 를 INSERT ... SELECT 로
--      copyright_rule_values 에 그대로 펼침.
--   4) RLS 정책 포함 — copyright_rules 의 기존 패턴(공개 SELECT + 인증 ALL)을
--      신규 두 테이블에 동일하게 적용.
--
-- i18n
--   column 자체의 i18n 은 row 분리(language 컬럼) 대신 한 row 에 label_ko/en/jp
--   3개 컬럼으로 묶음. 이유: "이 열은 SNS 업로드" 라는 정체성은 언어 독립이고,
--   라벨만 언어별로 다를 뿐이므로 row 를 3배로 늘릴 이유가 없음.
--
-- 실행 순서
--   Supabase 콘솔 → SQL Editor 에 전체 붙여넣어 실행. 트랜잭션은 BEGIN/COMMIT 으로
--   감싸 한 번에 적용.
-- =====================================================================

BEGIN;

-- 이전 실행 시도가 FK 타입 불일치로 실패한 흔적이 남아있을 수 있어 cleanup.
-- 트랜잭션이 ROLLBACK 됐다면 어차피 비어있어 no-op, 부분 적용된 상태라면
-- CASCADE 로 자식 FK·정책까지 함께 정리. 재실행 안전.
DROP TABLE IF EXISTS copyright_rule_values CASCADE;
DROP TABLE IF EXISTS copyright_columns     CASCADE;

-- gen_random_uuid() 가 의존하는 extension. Supabase 는 기본 활성화돼 있지만
-- 셀프호스팅 / 새 프로젝트에서도 안전하도록 명시.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 1) copyright_columns — 열 정의
--    이 프로젝트의 모든 테이블 PK 가 uuid 라 동일 규약 사용.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS copyright_columns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- column_key: 마이그레이션 식별자. 기존 5개 열을 추적하기 위해 둠.
  -- 신규 어드민 추가 열은 NULL 허용.
  column_key  text UNIQUE,
  label_ko    text NOT NULL,
  label_en    text,
  label_jp    text,
  order_num   int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copyright_columns_order
  ON copyright_columns (order_num);

-- updated_at 자동 갱신 트리거 (다른 테이블과 동일 패턴이라 가정).
-- 트리거 함수가 프로젝트에 이미 있으면 그대로 재사용, 없으면 만든다.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_copyright_columns_updated_at ON copyright_columns;
CREATE TRIGGER trg_copyright_columns_updated_at
BEFORE UPDATE ON copyright_columns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 2) copyright_rule_values — 셀 값
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS copyright_rule_values (
  rule_id    uuid    NOT NULL REFERENCES copyright_rules(id)   ON DELETE CASCADE,
  column_id  uuid    NOT NULL REFERENCES copyright_columns(id) ON DELETE CASCADE,
  checked    boolean NOT NULL DEFAULT false,
  PRIMARY KEY (rule_id, column_id)
);

CREATE INDEX IF NOT EXISTS idx_copyright_rule_values_rule
  ON copyright_rule_values (rule_id);

-- ---------------------------------------------------------------------
-- 3) 기존 5개 열 시드 (column_key 기준 ON CONFLICT 로 idempotent)
-- ---------------------------------------------------------------------
INSERT INTO copyright_columns (column_key, label_ko, order_num) VALUES
  ('allow_personal',  '개인소장',     0),
  ('allow_sns',       'SNS 업로드',   1),
  ('allow_broadcast', '방송 사용',    2),
  ('allow_youtube',   '유튜브',       3),
  ('allow_goods',     '굿즈 및 판매', 4)
ON CONFLICT (column_key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4) 기존 boolean 데이터 → copyright_rule_values 로 펼치기
--
-- ON CONFLICT (rule_id, column_id) DO NOTHING:
--   재실행 시 어드민이 이미 토글한 셀 값을 덮지 않는다.
--   "boolean 컬럼이 ground truth" 로 강제 재동기화하려면
--   DO UPDATE SET checked = EXCLUDED.checked 로 바꾼다.
-- ---------------------------------------------------------------------
INSERT INTO copyright_rule_values (rule_id, column_id, checked)
SELECT r.id, c.id,
  CASE c.column_key
    WHEN 'allow_personal'  THEN r.allow_personal
    WHEN 'allow_sns'       THEN r.allow_sns
    WHEN 'allow_broadcast' THEN r.allow_broadcast
    WHEN 'allow_youtube'   THEN r.allow_youtube
    WHEN 'allow_goods'     THEN r.allow_goods
  END
FROM copyright_rules r
CROSS JOIN copyright_columns c
WHERE c.column_key IN
  ('allow_personal','allow_sns','allow_broadcast','allow_youtube','allow_goods')
ON CONFLICT (rule_id, column_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5) RLS — copyright_rules 의 기존 패턴 그대로:
--      "Anyone can read ..."  : SELECT, USING (true)
--      "Auth can write ..."   : ALL,    USING (auth.role() = 'authenticated')
--    DROP POLICY IF EXISTS → CREATE POLICY 순으로 idempotent.
-- ---------------------------------------------------------------------
ALTER TABLE copyright_columns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE copyright_rule_values  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read copyright_columns" ON copyright_columns;
CREATE POLICY "Anyone can read copyright_columns"
  ON copyright_columns
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Auth can write copyright_columns" ON copyright_columns;
CREATE POLICY "Auth can write copyright_columns"
  ON copyright_columns
  FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can read copyright_rule_values" ON copyright_rule_values;
CREATE POLICY "Anyone can read copyright_rule_values"
  ON copyright_rule_values
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Auth can write copyright_rule_values" ON copyright_rule_values;
CREATE POLICY "Auth can write copyright_rule_values"
  ON copyright_rule_values
  FOR ALL
  USING (auth.role() = 'authenticated');

COMMIT;

-- =====================================================================
-- 검증 쿼리 (마이그레이션 후 수동 실행 권장)
--
-- 1) 펼친 개수가 기대치(N rules × 5 columns) 인지
--   SELECT
--     (SELECT count(*) FROM copyright_rules)        AS rules,
--     (SELECT count(*) FROM copyright_columns)      AS cols,
--     (SELECT count(*) FROM copyright_rule_values)  AS vals;
--
-- 2) 기존 boolean 값과 새 테이블 값이 일치하는지
--   SELECT r.id, r.label,
--     r.allow_personal  = bool_or(v.checked) FILTER (WHERE c.column_key='allow_personal')  AS ok_personal,
--     r.allow_sns       = bool_or(v.checked) FILTER (WHERE c.column_key='allow_sns')       AS ok_sns,
--     r.allow_broadcast = bool_or(v.checked) FILTER (WHERE c.column_key='allow_broadcast') AS ok_broadcast,
--     r.allow_youtube   = bool_or(v.checked) FILTER (WHERE c.column_key='allow_youtube')   AS ok_youtube,
--     r.allow_goods     = bool_or(v.checked) FILTER (WHERE c.column_key='allow_goods')     AS ok_goods
--   FROM copyright_rules r
--   JOIN copyright_rule_values v ON v.rule_id = r.id
--   JOIN copyright_columns   c ON c.id      = v.column_id
--   GROUP BY r.id;
--   --> 모든 ok_* 가 true 여야 함.
--
-- 롤백
--   DROP TABLE IF EXISTS copyright_rule_values;
--   DROP TABLE IF EXISTS copyright_columns;
--   (기존 boolean 컬럼은 그대로 남아있어 UI 한 줄 되돌리면 복구된다)
--
-- Deprecated 컬럼 정리 (UI 전환 + 1~2주 운영 후 별도 PR)
--   ALTER TABLE copyright_rules
--     DROP COLUMN allow_personal,
--     DROP COLUMN allow_sns,
--     DROP COLUMN allow_broadcast,
--     DROP COLUMN allow_youtube,
--     DROP COLUMN allow_goods;
-- =====================================================================
