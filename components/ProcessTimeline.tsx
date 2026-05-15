"use client";

import { useState } from "react";

import { sanitizeRich } from "@/lib/utils/sanitize";
import type { ProcessStep } from "@/types/database";

type Props = {
  steps: ProcessStep[];
};

export default function ProcessTimeline({ steps }: Props) {
  // hover/탭 시 활성화되는 단계의 id. 마우스 호버는 onMouseEnter/Leave 로,
  // 터치는 onClick 으로 토글.
  const [activeId, setActiveId] = useState<string | null>(null);

  if (steps.length === 0) {
    return (
      <p className="l2d-timeline-empty">작업 과정이 아직 없어요.</p>
    );
  }

  return (
    <ol className="l2d-timeline">
      {steps.map((step, idx) => {
        const isActive = activeId === step.id;
        const hasDescription = !!step.description?.trim();
        return (
          <li
            key={step.id}
            className={`l2d-step${isActive ? " l2d-step-active" : ""}`}
            onMouseEnter={() => setActiveId(step.id)}
            onMouseLeave={() =>
              setActiveId((cur) => (cur === step.id ? null : cur))
            }
            onClick={() =>
              setActiveId((cur) => (cur === step.id ? null : step.id))
            }
          >
            <div className="l2d-step-header">
              <span className="l2d-step-num" aria-hidden>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <p className="l2d-step-text">{step.title}</p>
            </div>
            {hasDescription && (
              <div
                className="l2d-step-description"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRich(step.description!),
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
