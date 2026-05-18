import ProcessManager from "@/components/admin/ProcessManager";
import { SETTING_KEYS } from "@/lib/admin/setting-keys";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminProcessPage() {
  const supabase = createClient();
  const locale = await getCurrentLocale();

  const [stepsRes, typesRes, typeItemsRes, aiToggleRes] = await Promise.all([
    supabase
      .from("process_steps")
      .select("*")
      .eq("language", locale)
      .order("step_num", { ascending: true }),
    supabase
      .from("live2d_types")
      .select("*")
      .eq("language", locale)
      .order("order_num", { ascending: true }),
    supabase
      .from("live2d_type_items")
      .select("*")
      .eq("language", locale)
      .order("order_num", { ascending: true }),
    supabase
      .from("settings")
      .select("value")
      .eq("key", SETTING_KEYS.aiTranslationEnabled)
      .eq("language", "ko")
      .maybeSingle(),
  ]);

  if (stepsRes.error) {
    console.error("[admin/process] fetch steps failed:", stepsRes.error.message);
  }
  if (typesRes.error) {
    console.error("[admin/process] fetch types failed:", typesRes.error.message);
  }
  if (typeItemsRes.error) {
    console.error(
      "[admin/process] fetch type items failed:",
      typeItemsRes.error.message,
    );
  }

  const aiTranslationEnabled = aiToggleRes.data?.value === "true";

  return (
    <ProcessManager
      initialSteps={stepsRes.data ?? []}
      initialTypes={typesRes.data ?? []}
      initialTypeItems={typeItemsRes.data ?? []}
      locale={locale}
      aiTranslationEnabled={aiTranslationEnabled}
    />
  );
}
