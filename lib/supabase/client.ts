import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

// 클라이언트 컴포넌트(브라우저)에서 사용하는 Supabase 인스턴스입니다.
// 인증 세션이 쿠키 기반으로 관리되도록 @supabase/ssr 의 createBrowserClient 를 사용합니다.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
