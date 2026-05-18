-- =====================================================================
-- 004_en_jp_seed.sql
--
-- KO 데이터가 어드민에 입력된 상태에서 같은 translation_key 로 EN/JP row 를
-- 추가하는 시드 마이그레이션. Cho 가 직접 제공한 번역본 사용.
--
-- 안전 원칙
--   - 트랜잭션으로 감싸 도중 실패 시 ROLLBACK.
--   - 모든 INSERT 가 ko row 의 translation_key 를 subquery 로 끌어오므로
--     ko row 가 없는 항목은 NULL translation_key INSERT 실패 → 트랜잭션 abort.
--   - UPDATE (copyright_columns) 는 column_key 로 매칭, 멱등.
--
-- 적용
--   Supabase 콘솔 → SQL Editor 에 통째로 붙여넣어 한 번 실행.
--   재실행은 안전하지 않음 — 같은 translation_key 의 en/jp row 가 이미 있으면
--   UNIQUE(translation_key, language) 위반으로 abort.
--
-- 범위 밖 (별도 PR)
--   - live2d_type_items   : translation_key 없음. 마이그레이션 + 매핑 PR 필요.
--   - copyright_rules     : label 단일 컬럼 (스키마 한계). 마이그레이션 PR 필요.
--   - settings (intro/sns): KO fallback 으로 충분. 필요 시 별도 추가.
--   - 신청서 폼 라벨        : 컴포넌트 하드코딩, i18n 인프라 PR 필요.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- A. notices — 자기소개 (section='intro')
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO notices (category, section, title, content, order_num, language, translation_key)
SELECT category, section, title,
  '<p>I always bring my best self to work! Please direct all inquiries to the form or the email below.</p>',
  order_num, 'en', translation_key
FROM notices WHERE category='common' AND section='intro' AND language='ko';

INSERT INTO notices (category, section, title, content, order_num, language, translation_key)
SELECT category, section, title,
  '<p>いつも真心を込めて作業いたします。お問い合わせは以下のフォーム及びメールでお願いします！</p>',
  order_num, 'jp', translation_key
FROM notices WHERE category='common' AND section='intro' AND language='ko';

-- ─────────────────────────────────────────────────────────────────────
-- B. notices — 공지사항 (section='notice')
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO notices (category, section, title, content, order_num, language, translation_key)
SELECT category, section, title,
  '<ol><li>I do not take responsibility for all disadvantages caused by a failure of reading the notice.</li><li>All works can be uploaded on my social media or used in my portfolio.</li><li>After payment, it takes about 45 days to be completed. This is subject to change depending on the model''s quality or the number of confirmations. (This is an advance notice.)</li><li>Any AI-related activities using my work is prohibited.</li><li>Posting or showing the sketch publicly is prohibited.</li><li>Reselling the model is also prohibited.</li></ol>',
  order_num, 'en', translation_key
FROM notices WHERE category='common' AND section='notice' AND language='ko';

INSERT INTO notices (category, section, title, content, order_num, language, translation_key)
SELECT category, section, title,
  '<ol><li>告知事項を読まないことによって生じる不利益については責任を負いません。</li><li>すべての作品はSNSやポートフォリオに使われることがあります。</li><li>制作には決済日から45日程の時間を頂きます。クオリティや確認過程により日数が増減する場合があります。(事前にお知らせします)</li><li>作業物を利用したすべてのAI関連の活動を禁止します。</li><li>ラフ絵を公開されたところに掲示したり、他に見せることを禁止します。</li><li>モデルの再販売を禁止します。</li></ol>',
  order_num, 'jp', translation_key
FROM notices WHERE category='common' AND section='notice' AND language='ko';

-- ─────────────────────────────────────────────────────────────────────
-- C. notices — 환불 안내 (section='refund')
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO notices (category, section, title, content, order_num, language, translation_key)
SELECT category, section, title,
  '<ol><li>100% refund before the work starts</li><li>70% refund after the sketch</li><li>30% refund during illustration</li><li>Refunds are not possible during the final stage of work</li><li>Refund due to a change of mind is not possible at any time.</li></ol>',
  order_num, 'en', translation_key
FROM notices WHERE category='common' AND section='refund' AND language='ko';

INSERT INTO notices (category, section, title, content, order_num, language, translation_key)
SELECT category, section, title,
  '<ol><li>作業前のキャンセル：100% 払い戻し</li><li>ラフ作業後のキャンセル：70% 払い戻し</li><li>イラスト作業中のキャンセル：30% 払い戻し</li><li>最終作業の進行中は返金できません。</li><li>すべての過程において単純な心変わりによる払い戻しはできません。</li></ol>',
  order_num, 'jp', translation_key
FROM notices WHERE category='common' AND section='refund' AND language='ko';

-- ─────────────────────────────────────────────────────────────────────
-- D. copyright_columns — 5개 시드 컬럼의 label_en / label_jp UPDATE
--    (column_key 로 매칭. 멱등 — 재실행해도 같은 값으로 덮어쓸 뿐.)
-- ─────────────────────────────────────────────────────────────────────
UPDATE copyright_columns SET label_en='Personal storage',     label_jp='個人保存'         WHERE column_key='allow_personal';
UPDATE copyright_columns SET label_en='SNS upload',           label_jp='SNS投稿'          WHERE column_key='allow_sns';
UPDATE copyright_columns SET label_en='Use in broadcasts',    label_jp='放送での使用'     WHERE column_key='allow_broadcast';
UPDATE copyright_columns SET label_en='YouTube',              label_jp='YouTube'          WHERE column_key='allow_youtube';
UPDATE copyright_columns SET label_en='Merchandise & sales',  label_jp='グッズおよび販売' WHERE column_key='allow_goods';

-- ─────────────────────────────────────────────────────────────────────
-- E. copyright_rules.label (방송용 / 상업용)
--    스키마에 language/translation_key 없음 — 다국어화 불가. 후속 PR.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- F. price_items — Live2D 메인 가격 (subcategory=null, is_addon=false)
--    KO 가정: item_name '일러스트 타입' / '전신 + 리깅 타입'
--    KO item_name 이 다르면 아래 WHERE 의 LIKE 패턴을 수정.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT category, 'Illustration type', 820, is_addon, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items
WHERE category='live2d' AND is_addon=false AND language='ko' AND item_name LIKE '%일러스트 타입%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT category, 'イラストプラン', 130000, is_addon, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items
WHERE category='live2d' AND is_addon=false AND language='ko' AND item_name LIKE '%일러스트 타입%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT category, 'Illustration + rigging type', 1300, is_addon, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items
WHERE category='live2d' AND is_addon=false AND language='ko' AND item_name LIKE '%리깅%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT category, 'イラスト＋モデリングプラン', 200000, is_addon, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items
WHERE category='live2d' AND is_addon=false AND language='ko' AND item_name LIKE '%리깅%';

-- ─────────────────────────────────────────────────────────────────────
-- G. Live2D 추가금 — 보류 (별도 PR)
--
-- 현재 사이트가 단일 추가금 표만 표시하는데,
-- 실제로는 메인 타입(일러 only / 일러+리깅)별 가격이 다름.
-- 후속 PR 에서 사이트 UI 메인 타입별 분리표 신설 + KO row 7개 추가 +
-- EN/JP 데이터 입력을 한 번에 처리 예정.
-- 그때까지 EN/JP 페이지의 Live2D 추가금은 KO fallback (한글 노출).
--
-- 참고 — DB 조회 결과 (2026-05-19):
--   KO row 6개 (subcategory=null) 가 illust 기준 가격으로 존재:
--     비대칭 포즈 100000 / 헤어 150000 / 의상 250000 /
--     악세사리 50000 / 팔 파츠 50000 / 표정 파츠 10000
--   illust+rigging 전용 인하 가격 / iOS 기능 row 는 KO 에 없음.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- H. price_items — Illust 방송용 (subcategory='broadcast', is_addon=false)
-- ─────────────────────────────────────────────────────────────────────
-- 흉상
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Bust (Head to Waist)', 120, false, description, 'broadcast', is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND subcategory='broadcast' AND is_addon=false
  AND language='ko' AND item_name LIKE '%흉상%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'バストアップ（頭〜腰）', 16500, false, description, 'broadcast', is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND subcategory='broadcast' AND is_addon=false
  AND language='ko' AND item_name LIKE '%흉상%';

-- 반신
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Half Body (Head to Thigh)', 150, false, description, 'broadcast', is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND subcategory='broadcast' AND is_addon=false
  AND language='ko' AND item_name LIKE '%반신%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '半身（頭〜太もも）', 22000, false, description, 'broadcast', is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND subcategory='broadcast' AND is_addon=false
  AND language='ko' AND item_name LIKE '%반신%';

-- 전신
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Full Body (Head to Toe)', 190, false, description, 'broadcast', is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND subcategory='broadcast' AND is_addon=false
  AND language='ko' AND item_name LIKE '%전신%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '全身（頭〜足先）', 27500, false, description, 'broadcast', is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND subcategory='broadcast' AND is_addon=false
  AND language='ko' AND item_name LIKE '%전신%';

-- ─────────────────────────────────────────────────────────────────────
-- I. price_items — Illust 상업용 (subcategory='commercial', is_addon=false)
-- ─────────────────────────────────────────────────────────────────────
-- 1인 배경포함
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Single Character with Background', 420, false, description, 'commercial', is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND subcategory='commercial' AND is_addon=false
  AND language='ko' AND item_name LIKE '%배경포함%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '1人＋背景あり', 60500, false, description, 'commercial', is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND subcategory='commercial' AND is_addon=false
  AND language='ko' AND item_name LIKE '%배경포함%';

-- 1인 배경미포함
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Single Character without Background', 270, false, description, 'commercial', is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND subcategory='commercial' AND is_addon=false
  AND language='ko' AND item_name LIKE '%배경미포함%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '1人＋背景なし', 38500, false, description, 'commercial', is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND subcategory='commercial' AND is_addon=false
  AND language='ko' AND item_name LIKE '%배경미포함%';

-- ─────────────────────────────────────────────────────────────────────
-- J. price_items — Illust 추가금 (subcategory=null, is_addon=true)
-- ─────────────────────────────────────────────────────────────────────
-- 배경추가 (간단)
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Simple Background', 25, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%간단%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '簡単な背景', 3300, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%간단%';

-- 배경추가 (복잡)
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Complex Background', 55, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%복잡%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '複雑な背景', 7700, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%복잡%';

-- 가로 사이즈
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Horizontal Format', 40, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%가로%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '横構図', 5500, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%가로%';

-- R18
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'R18 Content', 55, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%R18%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'R18', 7700, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%R18%';

-- 빠른마감 (is_approx=true 가능성 — KO row 따라감)
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Rush Delivery (within 7 days)', 75, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%빠른마감%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', '特急仕上げ（7日以内・要相談）', 11000, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%빠른마감%';

-- 파츠분리
INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'Layer Separation (for wallpaper use)', 165, true, description, subcategory, is_approx, order_num, 'en', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%파츠분리%';

INSERT INTO price_items (category, item_name, price, is_addon, description, subcategory, is_approx, order_num, language, translation_key)
SELECT 'illust', 'パーツ分け（壁紙用・横構図ベース）', 24200, true, description, subcategory, is_approx, order_num, 'jp', translation_key
FROM price_items WHERE category='illust' AND is_addon=true AND language='ko'
  AND item_name LIKE '%파츠분리%';

-- ─────────────────────────────────────────────────────────────────────
-- K. process_steps — Live2D (8단계)
--    KO step_num 별로 매칭. step_num 이 같은 ko row 의 translation_key 사용.
-- ─────────────────────────────────────────────────────────────────────
-- step 1
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Inquiry and estimated price', description, 'en', translation_key
FROM process_steps WHERE category='live2d' AND step_num=1 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'お見積もり・ご相談', description, 'jp', translation_key
FROM process_steps WHERE category='live2d' AND step_num=1 AND language='ko';

-- step 2
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Sketch', description, 'en', translation_key
FROM process_steps WHERE category='live2d' AND step_num=2 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'ラフデザインの提出', description, 'jp', translation_key
FROM process_steps WHERE category='live2d' AND step_num=2 AND language='ko';

-- step 3
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Confirmation and editing (1st)', description, 'en', translation_key
FROM process_steps WHERE category='live2d' AND step_num=3 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, '確認・修正（1回目）', description, 'jp', translation_key
FROM process_steps WHERE category='live2d' AND step_num=3 AND language='ko';

-- step 4
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Work starts', description, 'en', translation_key
FROM process_steps WHERE category='live2d' AND step_num=4 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'イラストの作成', description, 'jp', translation_key
FROM process_steps WHERE category='live2d' AND step_num=4 AND language='ko';

-- step 5
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Final product (with miscellaneous edits)', description, 'en', translation_key
FROM process_steps WHERE category='live2d' AND step_num=5 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, '正規イラストの提出（微調整）', description, 'jp', translation_key
FROM process_steps WHERE category='live2d' AND step_num=5 AND language='ko';

-- step 6
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Starting the rigging', description, 'en', translation_key
FROM process_steps WHERE category='live2d' AND step_num=6 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'モデリング作業', description, 'jp', translation_key
FROM process_steps WHERE category='live2d' AND step_num=6 AND language='ko';

-- step 7
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Confirmation and edition (2nd)', description, 'en', translation_key
FROM process_steps WHERE category='live2d' AND step_num=7 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, '確認・修正（2回目）', description, 'jp', translation_key
FROM process_steps WHERE category='live2d' AND step_num=7 AND language='ko';

-- step 8
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Final product delivered', description, 'en', translation_key
FROM process_steps WHERE category='live2d' AND step_num=8 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, '納品', description, 'jp', translation_key
FROM process_steps WHERE category='live2d' AND step_num=8 AND language='ko';

-- ─────────────────────────────────────────────────────────────────────
-- L. process_steps — Illust (6단계)
--
-- ⚠️ EN 원본 데이터가 5단계로 누락된 1개가 있음 ("Confirmation and editing (2nd)").
--    JP/KO 와 step 수 mismatch 방지를 위해 보강해서 6단계로 INSERT.
--    Cho 가 의도한 EN 단어를 별도 확인 후 step 5 의 title 만 수정해도 OK.
-- ─────────────────────────────────────────────────────────────────────
-- step 1
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Inquiry and estimated price', description, 'en', translation_key
FROM process_steps WHERE category='illust' AND step_num=1 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'お問い合わせ・お見積もり確認', description, 'jp', translation_key
FROM process_steps WHERE category='illust' AND step_num=1 AND language='ko';

-- step 2
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Sketch', description, 'en', translation_key
FROM process_steps WHERE category='illust' AND step_num=2 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'ラフ作業', description, 'jp', translation_key
FROM process_steps WHERE category='illust' AND step_num=2 AND language='ko';

-- step 3
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Confirmation and editing (1st)', description, 'en', translation_key
FROM process_steps WHERE category='illust' AND step_num=3 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'ご確認・修正（1回）', description, 'jp', translation_key
FROM process_steps WHERE category='illust' AND step_num=3 AND language='ko';

-- step 4
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Final work', description, 'en', translation_key
FROM process_steps WHERE category='illust' AND step_num=4 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, '最終作業', description, 'jp', translation_key
FROM process_steps WHERE category='illust' AND step_num=4 AND language='ko';

-- step 5  ⚠️ EN 보강 (Cho 의 EN 원본에서는 누락)
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Confirmation and editing (2nd)', description, 'en', translation_key
FROM process_steps WHERE category='illust' AND step_num=5 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'ご確認・修正（2回）', description, 'jp', translation_key
FROM process_steps WHERE category='illust' AND step_num=5 AND language='ko';

-- step 6
INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, 'Final product', description, 'en', translation_key
FROM process_steps WHERE category='illust' AND step_num=6 AND language='ko';

INSERT INTO process_steps (category, step_num, title, description, language, translation_key)
SELECT category, step_num, '完成品の公開', description, 'jp', translation_key
FROM process_steps WHERE category='illust' AND step_num=6 AND language='ko';

-- ─────────────────────────────────────────────────────────────────────
-- M. live2d_types — type_key 별 (illust / rigging)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO live2d_types (type_key, title, order_num, language, translation_key)
SELECT type_key, 'Illustration type', order_num, 'en', translation_key
FROM live2d_types WHERE type_key='illust' AND language='ko';

INSERT INTO live2d_types (type_key, title, order_num, language, translation_key)
SELECT type_key, 'イラストプラン', order_num, 'jp', translation_key
FROM live2d_types WHERE type_key='illust' AND language='ko';

INSERT INTO live2d_types (type_key, title, order_num, language, translation_key)
SELECT type_key, 'Illustration + rigging type', order_num, 'en', translation_key
FROM live2d_types WHERE type_key='rigging' AND language='ko';

INSERT INTO live2d_types (type_key, title, order_num, language, translation_key)
SELECT type_key, 'イラスト＋モデリングプラン', order_num, 'jp', translation_key
FROM live2d_types WHERE type_key='rigging' AND language='ko';

COMMIT;

-- =====================================================================
-- 검증 쿼리 (마이그레이션 후 수동 실행)
--
-- 1) 각 테이블의 (translation_key, language) 분포 확인
--   SELECT 'notices'        AS tbl, language, count(*) FROM notices WHERE category='common' GROUP BY language
--   UNION ALL SELECT 'price_items',   language, count(*) FROM price_items GROUP BY language
--   UNION ALL SELECT 'process_steps', language, count(*) FROM process_steps GROUP BY language
--   UNION ALL SELECT 'live2d_types',  language, count(*) FROM live2d_types GROUP BY language
--   ORDER BY tbl, language;
--
-- 2) copyright_columns 가 다국어 채워졌는지
--   SELECT column_key, label_ko, label_en, label_jp FROM copyright_columns ORDER BY order_num;
--
-- 3) translation_key 별 row 수 (ko 1개 + en 1개 + jp 1개 = 3 인 그룹이 표준)
--   SELECT translation_key, count(*) c FROM notices WHERE category='common'
--   GROUP BY translation_key HAVING count(*) <> 3;
--   --> 빈 결과여야 함 (이번 마이그레이션 후 모든 notices 가 3개 언어 row 보유).
--
-- 롤백
--   각 테이블에서 language IN ('en','jp') 인 row 삭제. (translation_key 와 함께 한 번에)
--   ⚠️ 다른 곳에서 만든 EN/JP row 도 같이 사라지므로 신중. 일반적으로 ROLLBACK 보다는
--      필요한 row 만 골라 DELETE.
--
--   예시 (이번 마이그레이션이 추가한 notices EN/JP 만):
--     DELETE FROM notices WHERE category='common' AND section IN ('intro','notice','refund')
--       AND language IN ('en','jp');
-- =====================================================================
