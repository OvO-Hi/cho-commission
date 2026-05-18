import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

// 전반 폰트를 더 가늘고 세련된 인상으로 바꾸기 위해 DM Sans를 사용합니다.
// next/font를 통해 폰트 파일을 최적화 로드하므로 성능 부담을 줄일 수 있습니다.
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  // 브랜드 표기를 요청사항에 맞춰 Sho -> Cho로 통일합니다.
  title: "STUDIO CHO",
  description: "STUDIO CHO — Live2D / Illustration commission",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      {/* body에는 폰트 변수만 보장하고, 실제 텍스트 색/레이아웃 스타일은 globals.css에서 관리합니다.
          이렇게 분리하면 유틸리티 클래스 의존도를 낮춰 렌더 차이를 줄일 수 있습니다. */}
      {/* serif/italic 폰트를 제거하고, 전체를 DM Sans 단일 체계로 통일합니다. */}
      <body className={dmSans.variable}>
        {children}
      </body>
    </html>
  );
}
