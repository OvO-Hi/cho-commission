-- =====================================================================
-- 007_live2d_addon_main_type.sql
--
-- Live2D 추가금을 메인 타입별로 분리. 기존 6개 KO 추가금은 Illust type 기준
-- (Cho 확인). Illust+rigging 전용 인하 가격 + iOS 기능 = 신규 7 row.
--
-- 스키마: price_items 에 main_type TEXT 컬럼 추가.
--   'illust'  : Illustration type 전용
--   'rigging' : Illustration + rigging type 전용
--   NULL      : 메인 타입 무관 (illust 카테고리 전체 + live2d 가 아닌 모든 row)
--
-- live2d 의 메인 가격 row 에도 main_type 채움 — 사용자 페이지가 메인 카드와
-- 그 안의 추가금을 main_type 으로 묶기 위함.
--
-- 적용
--   Supabase SQL Editor 에 통째로 붙여넣어 실행.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS main_type TEXT;

-- ─────────────────────────────────────────────────────────────────────
-- 2. 기존 live2d row 의 main_type 채우기
--
-- 2-A. live2d 메인 가격 — translation_key 로 같은 row 의 모든 언어 일괄 매칭.
--      KO 의 item_name 으로 식별 후 그 translation_key 의 en/jp 도 같이 UPDATE.
-- ─────────────────────────────────────────────────────────────────────
UPDATE price_items SET main_type = 'illust'
WHERE translation_key IN (
  SELECT translation_key FROM price_items
  WHERE category='live2d' AND is_addon=false AND language='ko'
    AND item_name = '일러스트 타입'
);

UPDATE price_items SET main_type = 'rigging'
WHERE translation_key IN (
  SELECT translation_key FROM price_items
  WHERE category='live2d' AND is_addon=false AND language='ko'
    AND item_name = '전신 + 리깅 타입'
);

-- 2-B. 기존 live2d 추가금 — 6개 KO row 는 illust 기준 (Cho 확인). KO 와 동일
--      translation_key 의 EN/JP 도 같이 main_type='illust'. (현재 EN/JP 는 없지만
--      향후 보강 시 일관성 확보.)
UPDATE price_items SET main_type = 'illust'
WHERE category='live2d' AND is_addon=true;

-- ─────────────────────────────────────────────────────────────────────
-- 3. 신규 KO rigging 추가금 7 row INSERT
--    각 row 새 translation_key (gen_random_uuid).
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO price_items
  (category, item_name, price, is_addon, description, subcategory, is_approx,
   order_num, language, translation_key, main_type)
VALUES
  ('live2d', '비대칭 포즈', 100000, true, NULL, NULL, false, 0, 'ko', gen_random_uuid(), 'rigging'),
  ('live2d', '헤어',        100000, true, NULL, NULL, false, 1, 'ko', gen_random_uuid(), 'rigging'),
  ('live2d', '의상',        200000, true, NULL, NULL, false, 2, 'ko', gen_random_uuid(), 'rigging'),
  ('live2d', '악세사리',     30000, true, NULL, NULL, false, 3, 'ko', gen_random_uuid(), 'rigging'),
  ('live2d', '팔 파츠',      30000, true, NULL, NULL, false, 4, 'ko', gen_random_uuid(), 'rigging'),
  ('live2d', '표정 파츠',    10000, true, NULL, NULL, false, 5, 'ko', gen_random_uuid(), 'rigging'),
  ('live2d', 'iOS 기능',     30000, true, NULL, NULL, false, 6, 'ko', gen_random_uuid(), 'rigging');

-- ─────────────────────────────────────────────────────────────────────
-- 4. EN/JP for illust type 추가금 (기존 KO 추가금 매칭, 12 row)
--    KO item_name = 동등 매칭. SQL 005 에서 학습한 패턴.
-- ─────────────────────────────────────────────────────────────────────
-- 비대칭 포즈
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Asymmetrical pose', 70, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='비대칭 포즈';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', '非対称のデザイン', 10000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='비대칭 포즈';

-- 헤어
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Hair', 105, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='헤어';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'ヘア', 15000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='헤어';

-- 의상
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Clothes', 175, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='의상';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', '衣装', 25000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='의상';

-- 악세사리
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Accessories', 35, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='악세사리';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'アクセサリー', 5000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='악세사리';

-- 팔 파츠
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Arm parts', 35, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='팔 파츠';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', '腕のパーツ', 5000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='팔 파츠';

-- 표정 파츠
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Facial expressions', 7, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='표정 파츠';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', '表情のパーツ', 1000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'illust'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='illust' AND language='ko' AND item_name='표정 파츠';

-- ─────────────────────────────────────────────────────────────────────
-- 5. EN/JP for rigging type 추가금 (방금 INSERT 한 KO rigging row 매칭, 14 row)
--    같은 트랜잭션 안의 INSERT 결과를 SELECT 로 조회 가능 (PG 표준).
-- ─────────────────────────────────────────────────────────────────────
-- 비대칭 포즈
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Asymmetrical pose', 70, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='비대칭 포즈';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', '非対称のデザイン', 10000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='비대칭 포즈';

-- 헤어
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Hair', 70, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='헤어';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'ヘア', 10000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='헤어';

-- 의상
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Clothes', 140, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='의상';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', '衣装', 20000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='의상';

-- 악세사리
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Accessories', 21, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='악세사리';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'アクセサリー', 3000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='악세사리';

-- 팔 파츠
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Arm parts', 21, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='팔 파츠';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', '腕のパーツ', 3000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='팔 파츠';

-- 표정 파츠
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'Facial expressions', 7, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='표정 파츠';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', '表情のパーツ', 1000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='표정 파츠';

-- iOS 기능
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'iOS feature', 21, true, description, subcategory, is_approx, order_num, 'en', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='iOS 기능';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key, main_type)
SELECT 'live2d', 'iOS機能', 3000, true, description, subcategory, is_approx, order_num, 'jp', translation_key, 'rigging'
FROM price_items WHERE category='live2d' AND is_addon=true AND main_type='rigging' AND language='ko' AND item_name='iOS 기능';

COMMIT;

-- =====================================================================
-- 검증 쿼리 (마이그레이션 후 수동 실행)
--
--   SELECT main_type, language, count(*)
--   FROM price_items
--   WHERE category='live2d' AND is_addon=true
--   GROUP BY main_type, language
--   ORDER BY main_type, language;
--
-- 기대 (총 26 추가금 row):
--   illust  / en  6
--   illust  / jp  6
--   illust  / ko  6
--   rigging / en  7
--   rigging / jp  7
--   rigging / ko  7
--
--   SELECT main_type, language, item_name
--   FROM price_items
--   WHERE category='live2d' AND is_addon=false
--   ORDER BY main_type, language;
--
-- 기대 (총 6 메인 row, main_type 채워짐):
--   illust  / en  Illustration type
--   illust  / jp  イラストプラン
--   illust  / ko  일러스트 타입
--   rigging / en  Illustration + rigging type
--   rigging / jp  イラスト＋モデリングプラン
--   rigging / ko  전신 + 리깅 타입
--
-- 변경 합계:
--   UPDATE: 12 (live2d 메인 6 + 기존 KO 추가금 6)
--   INSERT: 33 (KO rigging 추가금 7 + EN illust 6 + JP illust 6 + EN rigging 7 + JP rigging 7)
-- =====================================================================
