import PricingManager from "@/components/admin/PricingManager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("price_items")
    .select("*")
    .eq("language", "ko")
    .order("order_num", { ascending: true });

  if (error) {
    console.error("[admin/pricing] fetch failed:", error.message);
  }

  return <PricingManager initial={data ?? []} />;
}
