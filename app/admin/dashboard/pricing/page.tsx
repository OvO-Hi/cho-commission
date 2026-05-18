import PricingManager from "@/components/admin/PricingManager";
import { SETTING_KEYS } from "@/lib/admin/setting-keys";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const supabase = createClient();
  const locale = await getCurrentLocale();

  const [pricingRes, aiToggleRes] = await Promise.all([
    supabase
      .from("price_items")
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

  if (pricingRes.error) {
    console.error("[admin/pricing] fetch failed:", pricingRes.error.message);
  }

  const aiTranslationEnabled = aiToggleRes.data?.value === "true";

  return (
    <PricingManager
      initial={pricingRes.data ?? []}
      locale={locale}
      aiTranslationEnabled={aiTranslationEnabled}
    />
  );
}
