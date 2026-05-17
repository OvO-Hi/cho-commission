import SettingsManager from "@/components/admin/SettingsManager";
import { SETTING_KEYS } from "@/lib/admin/setting-keys";
import { getCurrentLocale } from "@/lib/i18n/locale";
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
  const locale = await getCurrentLocale();

  // 다국어 settings (intro/snsX/snsEmail) 은 현재 locale 로,
  // 글로벌 토글 (ai_translation_enabled) 은 항상 ko row 로 분리 fetch.
  const [localizedRes, aiToggleRes] = await Promise.all([
    supabase
      .from("settings")
      .select("key,value")
      .in("key", [
        SETTING_KEYS.intro,
        SETTING_KEYS.snsX,
        SETTING_KEYS.snsEmail,
      ])
      .eq("language", locale),
    supabase
      .from("settings")
      .select("value")
      .eq("key", SETTING_KEYS.aiTranslationEnabled)
      .eq("language", "ko")
      .maybeSingle(),
  ]);

  if (localizedRes.error) {
    console.error("[admin/settings] fetch failed:", localizedRes.error.message);
  }
  if (aiToggleRes.error) {
    console.error("[admin/settings] ai toggle fetch failed:", aiToggleRes.error.message);
  }

  const map = new Map((localizedRes.data ?? []).map((s) => [s.key, s.value]));
  // DB 에 row 가 아직 없을 수도 있고(마이그레이션 미적용), value 가 'false' 이면 false.
  const aiTranslationEnabled = aiToggleRes.data?.value === "true";

  return (
    <SettingsManager
      locale={locale}
      initial={{
        intro: map.get(SETTING_KEYS.intro) ?? DEFAULTS.intro,
        snsX: map.get(SETTING_KEYS.snsX) ?? DEFAULTS.snsX,
        snsEmail: map.get(SETTING_KEYS.snsEmail) ?? DEFAULTS.snsEmail,
      }}
      aiTranslationEnabled={aiTranslationEnabled}
    />
  );
}
