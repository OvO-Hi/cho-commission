import NoticesManager from "@/components/admin/NoticesManager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const supabase = createClient();

  const [noticesRes, rulesRes] = await Promise.all([
    supabase
      .from("notices")
      .select("*")
      .eq("category", "common")
      .eq("language", "ko")
      .order("order_num", { ascending: true }),
    supabase
      .from("copyright_rules")
      .select("*")
      .order("order_num", { ascending: true }),
  ]);

  if (noticesRes.error) {
    console.error("[admin/notices] fetch notices failed:", noticesRes.error.message);
  }
  if (rulesRes.error) {
    console.error("[admin/notices] fetch rules failed:", rulesRes.error.message);
  }

  return (
    <NoticesManager
      initialNotices={noticesRes.data ?? []}
      initialRules={rulesRes.data ?? []}
    />
  );
}
