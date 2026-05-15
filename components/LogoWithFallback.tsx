"use client";

import { useState } from "react";

export default function LogoWithFallback() {
  // 요구사항에 맞게 기본은 이미지 렌더링을 우선하고,
  // 실제 로드 실패(onError) 상황에서만 텍스트 fallback을 노출합니다.
  // 즉, "파일이 없거나 깨진 경우"에만 Cho 텍스트가 보이도록 의도한 분기입니다.
  const [loadFailed, setLoadFailed] = useState(false);

  if (loadFailed) {
    return (
      <span className="logo-fallback bubble-logo" aria-label="Cho logo fallback text">
        Cho
      </span>
    );
  }

  return (
    <>
      {/* width 는 globals.css 의 .logo-image clamp() 가 결정.
          여기서 width={180} HTML 속성을 두면 fixed presentational hint 로 작용해
          반응형 clamp 가 적용되지 않습니다. 클래스만 부여하고 크기는 CSS 로 위임. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Cho"
        className="logo-image"
        onError={() => setLoadFailed(true)}
      />
    </>
  );
}
