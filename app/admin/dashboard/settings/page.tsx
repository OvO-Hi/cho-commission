import SettingsManager from "@/components/admin/SettingsManager";
import { SETTING_KEYS } from "@/lib/admin/setting-keys";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 메인 페이지 표시 정보의 기본값. DB 에 row 가 없을 때 폴백으로 사용.
const DEFAULTS = {
  intro: "소개글 위치입니다.",
  snsX: "@cho__913",
  snsEmail: "chocano8913@gmail.com",
};

export default async function AdminSettingsPage() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .in("key", [
      SETTING_KEYS.intro,
      SETTING_KEYS.snsX,
      SETTING_KEYS.snsEmail,
    ])
    .eq("language", "ko");

  if (error) {
    console.error("[admin/settings] fetch failed:", error.message);
  }

  const map = new Map((data ?? []).map((s) => [s.key, s.value]));

  return (
    <SettingsManager
      initial={{
        intro: map.get(SETTING_KEYS.intro) ?? DEFAULTS.intro,
        snsX: map.get(SETTING_KEYS.snsX) ?? DEFAULTS.snsX,
        snsEmail: map.get(SETTING_KEYS.snsEmail) ?? DEFAULTS.snsEmail,
      }}
    />
  );
}
