import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 디자인 시안에서 반복 사용하는 파스텔 팔레트를 토큰화해,
      // 색을 하드코딩하지 않고 의미 기반으로 재사용할 수 있게 구성했습니다.
      colors: {
        softPink: "#FFE7F1",
        softMint: "#E6FED8",
        mintPoint: "#9EE17A",
        yellowAccent: "#FFE989",
        textMain: "#3a3a3a",
      },
      // 본문 전반의 둥글고 부드러운 인상을 위해 귀여운 계열 폰트를 기본 폰트 패밀리로 연결합니다.
      fontFamily: {
        // 전역 폰트를 DM Sans로 바꾼 뒤에도 Tailwind 확장 토큰이 같은 폰트를 바라보게 맞춥니다.
        cute: ["var(--font-dm-sans)", "sans-serif"],
      },
      boxShadow: {
        // 카드와 버튼에 은은한 입체감을 주기 위한 그림자 스타일입니다.
        bubble: "0 8px 20px rgba(58, 58, 58, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
