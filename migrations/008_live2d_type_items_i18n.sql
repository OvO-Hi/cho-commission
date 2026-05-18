-- =====================================================================
-- 008_live2d_type_items_i18n.sql
--
-- live2d_type_items 다국어화.
--
-- 배경
--   live2d_types 는 002 에서 translation_key + language 를 받았지만,
--   자식 live2d_type_items 는 002 의 제외 대상이었다 ("부모의 FK 만 따라감").
--   결과적으로 사용자 페이지의 EN/JP 에서 자식 항목이 비어 보이는 문제가 발생.
--
-- 이 마이그레이션은
--   1) translation_key uuid + language text 컬럼 추가
--   2) 기존 KO row 는 모두 language='ko', 새 UUID 부여
--   3) UNIQUE(translation_key, language) — 다른 다국어 테이블과 일관
--   4) 같은 부모(live2d_types) 의 translation_key 매핑을 통해 EN/JP 자식 row 를
--      각 언어의 부모 id 로 새로 INSERT. label/value 는 일단 KO 값 그대로 —
--      사용자가 어드민에서 EN/JP 탭으로 들어가 번역하는 흐름.
--
-- 적용
--   Supabase SQL Editor 에 통째로 붙여넣어 실행.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. 스키마 변경 — 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE live2d_type_items
  ADD COLUMN IF NOT EXISTS translation_key uuid,
  ADD COLUMN IF NOT EXISTS language text;

-- ─────────────────────────────────────────────────────────────────────
-- 2. 기존 row 백필 — 모두 KO 로 간주, row 마다 새 translation_key
--    재실행 안전: NULL 인 컬럼만 채움.
-- ─────────────────────────────────────────────────────────────────────
UPDATE live2d_type_items
  SET translation_key = gen_random_uuid()
  WHERE translation_key IS NULL;

UPDATE live2d_type_items
  SET language = 'ko'
  WHERE language IS NULL;

-- NOT NULL 강제
ALTER TABLE live2d_type_items ALTER COLUMN translation_key SET NOT NULL;
ALTER TABLE live2d_type_items ALTER COLUMN language SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 3. UNIQUE 제약 — 같은 (translation_key, language) 조합 중복 방지
--    다른 다국어 테이블과 일관성 확보. 002 의 헬퍼 DO 블록과 동일 패턴.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE live2d_type_items
  DROP CONSTRAINT IF EXISTS live2d_type_items_translation_key_language_key;
ALTER TABLE live2d_type_items
  ADD CONSTRAINT live2d_type_items_translation_key_language_key
  UNIQUE (translation_key, language);

-- ─────────────────────────────────────────────────────────────────────
-- 4. EN/JP 자식 row 생성 — 부모 종속 매핑
--
--    매핑 핵심:
--      - KO 자식의 부모는 KO live2d_types row.
--      - 그 부모의 translation_key 로 EN/JP 부모 row 의 id 를 찾는다.
--      - 새 자식의 type_id 는 EN/JP 부모의 id, translation_key 는 KO 자식과 동일.
--
--    label/value 는 일단 KO 값 그대로 복사 — 사용자가 어드민에서 번역.
--    ON CONFLICT DO NOTHING : 이미 EN/JP 자식이 있는 경우(재실행) 충돌 무시.
-- ─────────────────────────────────────────────────────────────────────

-- EN
INSERT INTO live2d_type_items
  (type_id, label, value, order_num, translation_key, language)
SELECT
  parent_en.id,
  child.label,
  child.value,
  child.order_num,
  child.translation_key,
  'en'
FROM live2d_type_items child
JOIN live2d_types parent_ko
  ON child.type_id = parent_ko.id
  AND parent_ko.language = 'ko'
JOIN live2d_types parent_en
  ON parent_ko.translation_key = parent_en.translation_key
  AND parent_en.language = 'en'
WHERE child.language = 'ko'
ON CONFLICT ON CONSTRAINT live2d_type_items_translation_key_language_key
DO NOTHING;

-- JP
INSERT INTO live2d_type_items
  (type_id, label, value, order_num, translation_key, language)
SELECT
  parent_jp.id,
  child.label,
  child.value,
  child.order_num,
  child.translation_key,
  'jp'
FROM live2d_type_items child
JOIN live2d_types parent_ko
  ON child.type_id = parent_ko.id
  AND parent_ko.language = 'ko'
JOIN live2d_types parent_jp
  ON parent_ko.translation_key = parent_jp.translation_key
  AND parent_jp.language = 'jp'
WHERE child.language = 'ko'
ON CONFLICT ON CONSTRAINT live2d_type_items_translation_key_language_key
DO NOTHING;

COMMIT;

-- =====================================================================
-- 검증 쿼리 (마이그레이션 후 수동 실행)
--
-- 1) 언어별 row 분포 — KO 개수 = EN 개수 = JP 개수 여야 한다.
--    (단, KO 자식의 부모(live2d_types) 가 EN/JP 부모를 못 찾으면 그 만큼 비어있을 수 있음)
--
--   SELECT language, count(*) FROM live2d_type_items GROUP BY language ORDER BY language;
--
-- 2) NOT NULL 검증
--   SELECT count(*) FILTER (WHERE translation_key IS NULL) AS tk_nulls,
--          count(*) FILTER (WHERE language IS NULL)        AS lang_nulls
--   FROM live2d_type_items;
--   --> 둘 다 0
--
-- 3) 부모 매핑 무결성 — 자식의 type_id 가 가리키는 부모의 language 가 자식 language 와 같아야 함.
--   SELECT child.id, child.language AS child_lang, parent.language AS parent_lang
--   FROM live2d_type_items child
--   JOIN live2d_types parent ON child.type_id = parent.id
--   WHERE child.language <> parent.language;
--   --> 빈 결과여야 함.
--
-- 4) 같은 translation_key 그룹 안에 같은 language 중복 없음 (UNIQUE 검증)
--   SELECT translation_key, language, count(*)
--   FROM live2d_type_items GROUP BY 1,2 HAVING count(*) > 1;
--   --> 빈 결과여야 함.
--
-- 롤백
--   BEGIN;
--   ALTER TABLE live2d_type_items
--     DROP CONSTRAINT IF EXISTS live2d_type_items_translation_key_language_key;
--   DELETE FROM live2d_type_items WHERE language IN ('en','jp');
--   ALTER TABLE live2d_type_items DROP COLUMN IF EXISTS translation_key;
--   ALTER TABLE live2d_type_items DROP COLUMN IF EXISTS language;
--   COMMIT;
-- =====================================================================
