import NoticesManager from "@/components/admin/NoticesManager";
import { SETTING_KEYS } from "@/lib/admin/setting-keys";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const supabase = createClient();
  const locale = await getCurrentLocale();

  const [noticesRes, rulesRes, columnsRes, valuesRes, aiToggleRes] = await Promise.all([
    supabase
      .from("notices")
      .select("*")
      .eq("category", "common")
      .eq("language", locale)
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
    // 글로벌 AI 번역 토글 — 다국어 무관, ko row 한 개만 확인.
    supabase
      .from("settings")
      .select("value")
      .eq("key", SETTING_KEYS.aiTranslationEnabled)
      .eq("language", "ko")
      .maybeSingle(),
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

  const aiTranslationEnabled = aiToggleRes.data?.value === "true";

  return (
    <NoticesManager
      initialNotices={noticesRes.data ?? []}
      initialRules={rulesRes.data ?? []}
      initialColumns={columnsRes.data ?? []}
      initialValues={valuesRes.data ?? []}
      locale={locale}
      aiTranslationEnabled={aiTranslationEnabled}
    />
  );
}
