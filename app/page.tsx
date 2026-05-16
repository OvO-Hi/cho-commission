import Link from "next/link";

import AdminEntry from "@/components/AdminEntry";
import LanguageToggle from "@/components/LanguageToggle";
import LogoWithFallback from "@/components/LogoWithFallback";
import { SETTING_KEYS } from "@/lib/admin/setting-keys";
import { fetchListWithFallback } from "@/lib/i18n/fetchWithFallback";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

// 어드민 사이트 설정 변경이 즉시 반영되도록 캐싱 비활성화.
export const dynamic = "force-dynamic";

// settings row 가 없거나 빈 값일 때 사용할 폴백.
const DEFAULTS = {
  intro: "소개글 위치입니다.",
  snsX: "@cho__913",
  snsEmail: "chocano8913@gmail.com",
};

export default async function Home() {
  const supabase = createClient();
  const locale = await getCurrentLocale();

  const [settingsData, bannerRes] = await Promise.all([
    fetchListWithFallback(
      async (lang) => {
        const res = await supabase
          .from("settings")
          .select("key,value")
          .in("key", [
            SETTING_KEYS.intro,
            SETTING_KEYS.snsX,
            SETTING_KEYS.snsEmail,
          ])
          .eq("language", lang);
        return res.data ?? [];
      },
      locale,
    ),
    supabase
      .from("banners")
      .select("image_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const map = new Map(settingsData.map((s) => [s.key, s.value]));
  // 빈 문자열도 폴백으로 처리해 화면이 비어 보이지 않도록 합니다.
  const introText = map.get(SETTING_KEYS.intro)?.trim() || DEFAULTS.intro;
  const snsX = map.get(SETTING_KEYS.snsX)?.trim() || DEFAULTS.snsX;
  const snsEmail = map.get(SETTING_KEYS.snsEmail)?.trim() || DEFAULTS.snsEmail;
  const bannerUrl = bannerRes.data?.image_url ?? null;

  return (
    // 레이아웃 전체를 전용 CSS 클래스 기반으로 구성해,
    // 특정 유틸리티 클래스가 누락되더라도 디자인이 안정적으로 유지되게 합니다.
    <main className="site-shell">
      <header className="top-bar">
        <div className="top-bar-inner">
          <LanguageToggle current={locale} />
        </div>
      </header>

      <section className="main-split">
        <aside className="left-panel">
          <div className="left-content">
            {/* 로고는 전용 컴포넌트에서 onError fallback을 처리해,
                마크업은 단순하게 유지하고 예외 처리를 분리했습니다. */}
            <LogoWithFallback />

            <nav className="left-nav">
              {/* 정보 우선순위(안내 -> 작업 카테고리)를 사용자 요청에 맞춰 재정렬했습니다. */}
              {/* next/link 로 클라이언트 사이드 라우팅을 적용해 페이지 전환 시 깜빡임을 줄입니다. */}
              <Link href="/notice">Notice</Link>
              <Link href="/live2d">Live2D</Link>
              <Link href="/illust">Illust</Link>
            </nav>

            <div className="left-contact">
              <p>
                <span aria-hidden>𝕏</span>
                <span>X(Twitter): {snsX}</span>
              </p>
              <p>
                <span aria-hidden>✉</span>
                <span>Email: {snsEmail}</span>
              </p>
            </div>
          </div>
        </aside>

        {/* 오른쪽 영역: 활성 배너가 있으면 2:1 비율로 표시, 없으면 빈 공간(그라디언트 노출) */}
        <article
          className="right-panel"
          aria-label={bannerUrl ? "메인 배너" : "Empty right panel"}
        >
          {bannerUrl && (
            <div className="banner-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerUrl} alt="" className="banner-image" />
            </div>
          )}
        </article>
      </section>

      {/* 우측 하단의 작은 어드민 진입 버튼. 평상시엔 거의 보이지 않게 톤다운. */}
      <AdminEntry />

      <footer className="bottom-bar">
        <div className="bottom-inner">
          <p className="bottom-title">LIVE2D | VTUBER | ILLUSTRATION</p>
          <p className="bottom-desc">{introText}</p>
        </div>
      </footer>
    </main>
  );
}
