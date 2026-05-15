import SlotsManager from "@/components/admin/SlotsManager";
import { createClient } from "@/lib/supabase/server";

// 어드민 슬롯 페이지는 항상 최신 상태가 보여야 하므로 캐싱 비활성화.
export const dynamic = "force-dynamic";

export default async function AdminSlotsPage() {
  const supabase = createClient();

  const [slotsRes, settingsRes] = await Promise.all([
    supabase.from("slots").select("*").order("slot_number", { ascending: true }),
    supabase
      .from("settings")
      .select("*")
      .in("key", ["live2d_open", "illust_open"])
      .eq("language", "ko"),
  ]);

  if (slotsRes.error) {
    console.error("[admin/slots] fetch slots failed:", slotsRes.error.message);
  }
  if (settingsRes.error) {
    console.error("[admin/slots] fetch settings failed:", settingsRes.error.message);
  }

  const slots = slotsRes.data ?? [];
  const settingsMap = new Map(
    (settingsRes.data ?? []).map((s) => [s.key, s.value]),
  );

  // 설정이 없으면 기본 'true' (열림). 명시적으로 'false' 일 때만 닫힌 상태.
  const initialOpen = {
    live2d: settingsMap.get("live2d_open") !== "false",
    illust: settingsMap.get("illust_open") !== "false",
  };

  return <SlotsManager initialSlots={slots} initialOpen={initialOpen} />;
}
