-- =====================================================================
-- 005_en_jp_seed_corrections.sql
--
-- 004_en_jp_seed.sql 실행 후, 일부 KO row 의 item_name 공백/하이픈이 LIKE
-- 패턴과 불일치하여 10개 INSERT 가 silent 하게 0 row INSERT 된 상태를 보강.
--
-- 누락된 KO 매칭 (LIKE 실패 → 실제 KO item_name):
--   '%배경포함%'   → '1인 배경 포함'   (공백)
--   '%배경미포함%' → '1인 배경 미포함' (공백)
--   '%R18%'        → 'R-18'           (하이픈)
--   '%빠른마감%'   → '빠른 마감'       (공백)
--   '%파츠분리%'   → '파츠 분리'       (공백)
--
-- 본 마이그레이션은 = 동등 매칭으로 KO row 를 찾아 EN/JP 각 1개씩 추가.
-- 총 10 INSERT 예정 (commercial 4 + addon 6).
--
-- 적용
--   Supabase SQL Editor 에 통째로 붙여넣어 실행.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- I-보강. price_items — Illust 상업용 (subcategory='commercial')
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Single Character with Background', 420, false, description, 'commercial', is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND subcategory='commercial' AND is_addon=false
  AND language='ko' AND item_name = '1인 배경 포함';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '1人＋背景あり', 60500, false, description, 'commercial', is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND subcategory='commercial' AND is_addon=false
  AND language='ko' AND item_name = '1인 배경 포함';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Single Character without Background', 270, false, description, 'commercial', is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND subcategory='commercial' AND is_addon=false
  AND language='ko' AND item_name = '1인 배경 미포함';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '1人＋背景なし', 38500, false, description, 'commercial', is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND subcategory='commercial' AND is_addon=false
  AND language='ko' AND item_name = '1인 배경 미포함';

-- ─────────────────────────────────────────────────────────────────────
-- J-보강. price_items — Illust 추가금 (subcategory=null, is_addon=true)
-- ─────────────────────────────────────────────────────────────────────
-- R-18
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'R18 Content', 55, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name = 'R-18';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'R18', 7700, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name = 'R-18';

-- 빠른 마감
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Rush Delivery (within 7 days)', 75, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name = '빠른 마감';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '特急仕上げ（7日以内・要相談）', 11000, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name = '빠른 마감';

-- 파츠 분리
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Layer Separation (for wallpaper use)', 165, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name = '파츠 분리';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'パーツ分け（壁紙用・横構図ベース）', 24200, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name = '파츠 분리';

COMMIT;

-- =====================================================================
-- 검증 (마이그레이션 후 수동 실행)
--
--   SELECT language, subcategory, is_addon, count(*)
--   FROM price_items WHERE category='illust' AND language IN ('en','jp')
--   GROUP BY language, subcategory, is_addon
--   ORDER BY language, subcategory NULLS LAST, is_addon;
--
-- 기대: en/broadcast/false=3, en/commercial/false=2, en/null/true=6,
--       jp 동일. 총 22 row.
-- =====================================================================
