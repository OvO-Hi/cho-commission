import NoticesManager from "@/components/admin/NoticesManager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const supabase = createClient();

  const [noticesRes, rulesRes, columnsRes, valuesRes] = await Promise.all([
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
    supabase
      .from("copyright_columns")
      .select("*")
      .order("order_num", { ascending: true }),
    supabase.from("copyright_rule_values").select("*"),
  ]);

  if (noticesRes.error) {
    console.error("[admin/notices] fetch notices failed:", noticesRes.error.message);
  }
  if (rulesRes.error) {
    console.error("[admin/notices] fetch rules failed:", rulesRes.error.message);
  }
  if (columnsRes.error) {
    console.error("[admin/notices] fetch columns failed:", columnsRes.error.message);
  }
  if (valuesRes.error) {
    console.error("[admin/notices] fetch values failed:", valuesRes.error.message);
  }

  return (
    <NoticesManager
      initialNotices={noticesRes.data ?? []}
      initialRules={rulesRes.data ?? []}
      initialColumns={columnsRes.data ?? []}
      initialValues={valuesRes.data ?? []}
    />
  );
}
