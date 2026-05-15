"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  // 등장 transition delay (ms). 여러 요소를 살짝 stagger 하고 싶을 때 사용.
  delay?: number;
};

// 뷰포트 진입 시 fade-in + slide-up. 한 번 보이면 unobserve (재진입해도 재실행 안 함).
// prefers-reduced-motion 켠 환경에서는 즉시 표시 (CSS @media 가 보조).
export default function ScrollReveal({ children, className = "", delay }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style =
    delay !== undefined
      ? { transitionDelay: `${delay}ms` }
      : undefined;

  return (
    <div
      ref={ref}
      style={style}
      className={`scroll-reveal${visible ? " is-visible" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </div>
  );
}
