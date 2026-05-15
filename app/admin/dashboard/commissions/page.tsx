import CommissionsList from "@/components/admin/CommissionsList";
import { createClient } from "@/lib/supabase/server";

// 어드민 페이지는 항상 최신 데이터가 보여야 하므로 캐싱을 비활성화.
export const dynamic = "force-dynamic";

export default async function AdminCommissionsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("commissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/commissions] fetch failed:", error.message);
  }

  return <CommissionsList initial={data ?? []} />;
}
