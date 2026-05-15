import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

// 서버 컴포넌트 / 라우트 핸들러 / 서버 액션에서 사용하는 Supabase 인스턴스입니다.
// Next.js 14 App Router 의 cookies() API 와 연동해 인증 세션을 동기화합니다.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          // Server Component 에서 set 호출 시 throw 가 발생할 수 있어 try/catch 로 감쌉니다.
          // 미들웨어 또는 Route Handler 에서만 실제로 쿠키가 갱신됩니다.
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // no-op: Server Component 에서는 무시
          }
        },
        remove(name: string, options) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // no-op
          }
        },
      },
    },
  );
}
