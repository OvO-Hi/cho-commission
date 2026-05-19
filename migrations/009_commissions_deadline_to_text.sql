-- =====================================================================
-- 009_commissions_deadline_to_text.sql
--
-- commissions.deadline 컬럼 타입 DATE → TEXT 변환.
--
-- 배경
--   어드민 UI 와 TS 타입(types/database.ts 의 Commission.deadline) 은
--   자유 텍스트("5/13", "2026-05-13" 등) 를 가정하지만, DB 스키마는
--   DATE 로 시드되어 있어 "5/25" 같은 비-ISO 입력이 400 으로 reject 됨.
--   사용자가 어드민 상세 모달에서 마감일을 저장하면 hooked into
--   .update({ deadline: "5/25" }) → PostgreSQL invalid_date_format.
--
-- 안전 원칙
--   - 현재 타입이 DATE 인 경우에만 ALTER (재실행 안전)
--   - USING deadline::TEXT 로 기존 DATE 값(있다면 "YYYY-MM-DD" 형태) 보존
--   - 다른 컬럼 / RLS / 인덱스 손 안 댐
--
-- 적용
--   Supabase SQL Editor 에 통째로 붙여넣어 실행.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'commissions'
      AND column_name = 'deadline'
  ) = 'date' THEN
    ALTER TABLE commissions
      ALTER COLUMN deadline TYPE TEXT
      USING deadline::TEXT;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- 검증 쿼리 (마이그레이션 후 수동 실행)
--
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name = 'commissions'
--     AND column_name = 'deadline';
--   --> data_type = 'text'
--
--   SELECT id, deadline FROM commissions WHERE deadline IS NOT NULL LIMIT 5;
--   --> 기존 DATE 값들은 "YYYY-MM-DD" 형태 TEXT 로 변환되어 남아 있어야 함.
-- =====================================================================
