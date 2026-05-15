import BannersManager from "@/components/admin/BannersManager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[admin/banners] fetch failed:", error.message);
  }

  return <BannersManager initial={data ?? null} />;
}
