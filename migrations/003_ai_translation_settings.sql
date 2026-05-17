-- =====================================================================
-- 003_ai_translation_settings.sql
--
-- AI 자동 번역 글로벌 토글 도입.
-- settings 테이블에 새 key='ai_translation_enabled' row 1개 추가 (language='ko').
-- 글로벌 설정이지만 별도 테이블/컬럼을 만들지 않고 기존 settings 구조 재사용 —
-- 어드민 SettingsManager 의 select/update/insert 패턴이 그대로 작동한다.
--
-- 다른 다국어 settings (intro/snsX/snsEmail) 와 달리 ko 외 언어 row 는 만들지
-- 않는다. 의미상 글로벌이라 어드민 토글이 한 곳만 켜고 끔.
--
-- translation_key 는 NOT NULL 제약 때문에 dummy uuid 부여 (이 row 는 번역 대상
-- 아니므로 단지 컬럼 채움용).
--
-- 안전 원칙
--   1) Idempotent — WHERE NOT EXISTS 로 재실행 시 중복 row 안 생김
--   2) Non-destructive — 기존 row / 스키마 손 안 댐
-- =====================================================================

BEGIN;

INSERT INTO settings (key, value, language, translation_key)
SELECT
  'ai_translation_enabled',
  'false',
  'ko',
  gen_random_uuid()
WHERE NOT EXISTS (
  SELECT 1 FROM settings WHERE key = 'ai_translation_enabled'
);

COMMIT;

-- =====================================================================
-- 검증 쿼리 (마이그레이션 후 수동 실행)
--
--   SELECT key, value, language FROM settings
--   WHERE key = 'ai_translation_enabled';
--   --> 정확히 1 row, value='false', language='ko'
--
-- 롤백
--   DELETE FROM settings WHERE key = 'ai_translation_enabled';
-- =====================================================================
