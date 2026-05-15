"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  deleteImage,
  uploadImage,
  type UploadResult,
} from "@/lib/storage/upload";
import type { ApplicationType } from "@/types/database";

type FormState = {
  nickname: string;
  contact: string;
  desired_date: string;
  process_private: boolean;
  portfolio_private: boolean;
  application_type: ApplicationType | "";
  character_description: string;
  additional_notes: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

type AttachedImage = {
  id: string;
  // 실제 업로드는 폼 제출 시 일괄 처리. 폼 안에서는 File 보관 + objectURL 미리보기.
  file: File;
  previewUrl: string;
};

const INITIAL: FormState = {
  nickname: "",
  contact: "",
  desired_date: "",
  // 기본값 상관없음 = false
  process_private: false,
  portfolio_private: false,
  application_type: "",
  character_description: "",
  additional_notes: "",
};

const APPLICATION_TYPE_OPTIONS: { value: ApplicationType; label: string }[] = [
  { value: "illust", label: "일러스트만" },
  { value: "both", label: "일러스트 + 리깅" },
];

const MAX_IMAGES = 5;

// sessionStorage 키. 완료 페이지에서 동일한 키로 읽습니다.
// 이미지는 dataURL 합산 용량이 커서 텍스트 페이로드와 분리해 따로 저장합니다 —
// 한쪽 저장이 실패해도 나머지는 보존되도록 하기 위함입니다.
export const LIVE2D_SUBMISSION_KEY = "live2d_submission";
export const LIVE2D_IMAGES_KEY = "live2d_submission_images";

export default function Live2DCommissionForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [images, setImages] = useState<AttachedImage[]>([]);
  // 업로드 단계와 INSERT 단계를 구분해 버튼 라벨에 표시.
  const [uploadingImages, setUploadingImages] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // input 을 비워 같은 파일을 다시 선택할 수 있도록.
    e.target.value = "";

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    const accepted = files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remaining);

    const newItems = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newItems]);
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!state.nickname.trim()) next.nickname = "닉네임을 입력해 주세요";
    if (!state.contact.trim()) next.contact = "연락처를 입력해 주세요";
    if (!state.application_type)
      next.application_type = "신청 타입을 선택해 주세요";
    if (!state.character_description.trim())
      next.character_description = "신청 캐릭터 정보를 입력해 주세요";
    return next;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting) {
      console.warn("[live2d-form] submit already in progress, ignoring");
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      console.warn(
        "[live2d-form] validation failed:",
        Object.keys(validationErrors),
      );
      setErrors(validationErrors);
      setSubmitError(null);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setErrors({});

    // 1) 이미지가 있으면 먼저 Storage 업로드. 일부라도 실패하면 성공한 것들을
    //    cleanup 후 전체 흐름 중단 — orphan 파일 최소화.
    let uploadedUrls: string[] = [];
    if (images.length > 0) {
      setUploadingImages(true);

      let results: (UploadResult | null)[];
      try {
        results = await Promise.all(
          images.map((img) =>
            uploadImage(img.file, "commission-images", "live2d"),
          ),
        );
      } catch (err) {
        // uploadImage 는 catch 내부에서 swallow 하므로 여기 도달은 거의 없지만 안전장치.
        console.error("[live2d-form] upload threw unexpectedly:", err);
        setUploadingImages(false);
        setSubmitError(
          "이미지 업로드 중 예외가 발생했어요. 잠시 후 다시 시도해 주세요.",
        );
        setSubmitting(false);
        return;
      }
      setUploadingImages(false);

      const successful = results.filter(
        (r): r is UploadResult => r !== null,
      );
      if (successful.length !== images.length) {
        console.error(
          "[live2d-form] PARTIAL FAILURE — succeeded:",
          successful.length,
          "/",
          images.length,
        );
        await Promise.all(
          successful.map((r) =>
            deleteImage("commission-images", r.path),
          ),
        );
        setSubmitError(
          "이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.",
        );
        setSubmitting(false);
        return;
      }
      uploadedUrls = successful.map((r) => r.url);
    }

    const supabase = createClient();
    const payload = {
      type: "live2d" as const,
      nickname: state.nickname.trim(),
      contact: state.contact.trim(),
      desired_date: state.desired_date.trim() || null,
      process_private: state.process_private,
      portfolio_private: state.portfolio_private,
      application_type: state.application_type as ApplicationType,
      character_description: state.character_description.trim(),
      additional_notes: state.additional_notes.trim() || null,
      is_read: false,
      // admin_label / deadline 은 어드민 페이지에서 부여하는 필드라 신청 시에는 null.
      admin_label: null,
      deadline: null,
      image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
    };

    const { error: insertError } = await supabase
      .from("commissions")
      .insert(payload);

    if (insertError) {
      console.error(
        "[live2d-form] insert failed:",
        insertError.message,
        "details:",
        JSON.stringify(insertError, null, 2),
      );
      if (uploadedUrls.length > 0) {
        console.warn(
          "[live2d-form] insert 실패 — 업로드된 이미지가 orphan 됩니다:",
          uploadedUrls,
        );
      }
      setSubmitError("제출 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
      return;
    }

    // 어드민 이메일 알림 — fire-and-forget. 실패해도 사용자 흐름은 중단하지 않음.
    void (async () => {
      try {
        await fetch("/api/commissions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            // INSERT 시 DB 가 채울 created_at 의 근사값. 분/초 단위 표기에서 큰 차이 없음.
            created_at: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("[live2d-form] notify fetch threw:", err);
      }
    })();

    try {
      sessionStorage.setItem(
        LIVE2D_SUBMISSION_KEY,
        JSON.stringify({ ...payload, submitted_at: new Date().toISOString() }),
      );
    } catch (err) {
      console.error("[live2d-form] sessionStorage submission save failed:", err);
    }

    if (uploadedUrls.length > 0) {
      try {
        sessionStorage.setItem(
          LIVE2D_IMAGES_KEY,
          JSON.stringify(uploadedUrls),
        );
      } catch (err) {
        console.error("[live2d-form] sessionStorage images save failed:", err);
      }
    } else {
      try {
        sessionStorage.removeItem(LIVE2D_IMAGES_KEY);
      } catch (err) {
        console.error("[live2d-form] sessionStorage images remove failed:", err);
      }
    }

    router.push("/live2d/complete");
  }

  const canAddImage = images.length < MAX_IMAGES;

  return (
    <form className="l2d-form" onSubmit={handleSubmit} noValidate>
      {/* 기본 정보 — 닉네임 + 연락처 한 줄, 모바일에서 스택 */}
      <div className="l2d-form-row">
        <div className="l2d-form-group">
          <label htmlFor="l2d-nickname" className="l2d-form-label">
            닉네임 <span className="l2d-form-req">*</span>
          </label>
          <input
            id="l2d-nickname"
            type="text"
            className={`l2d-form-input${errors.nickname ? " l2d-form-input-err" : ""}`}
            placeholder="닉네임을 입력해주세요"
            value={state.nickname}
            onChange={(e) => update("nickname", e.target.value)}
          />
          {errors.nickname && <p className="l2d-form-msg">{errors.nickname}</p>}
        </div>

        <div className="l2d-form-group">
          <label htmlFor="l2d-contact" className="l2d-form-label">
            연락처 <span className="l2d-form-req">*</span>
          </label>
          <input
            id="l2d-contact"
            type="text"
            className={`l2d-form-input${errors.contact ? " l2d-form-input-err" : ""}`}
            placeholder="예: @cho__913"
            value={state.contact}
            onChange={(e) => update("contact", e.target.value)}
          />
          {/* 안내문은 input 아래로 이동해 닉네임 group 의 (라벨 → input) 위치와 맞춥니다. */}
          <p className="l2d-form-hint">
            이메일, X, 디스코드 등 빠른 연락이 가능한 연락처를 남겨주세요
          </p>
          {errors.contact && <p className="l2d-form-msg">{errors.contact}</p>}
        </div>
      </div>

      <div className="l2d-form-group">
        <label htmlFor="l2d-date" className="l2d-form-label">
          수령 희망 날짜
          <span className="l2d-form-optional">(선택)</span>
        </label>
        <input
          id="l2d-date"
          type="text"
          /* 날짜는 짧은 입력이라 너비를 280px 로 제한해 시각적 균형을 잡습니다. */
          className="l2d-form-input l2d-form-input-narrow"
          placeholder="예: 3/15, 3-15 등"
          value={state.desired_date}
          onChange={(e) => update("desired_date", e.target.value)}
        />
      </div>

      {/* 비공개 옵션 두 개를 한 줄에 배치 */}
      <div className="l2d-form-row">
        <div className="l2d-form-group">
          <span className="l2d-form-label">
            작업과정 비공개 <span className="l2d-form-req">*</span>
          </span>
          <div className="l2d-radio-row">
            <RadioPill
              name="process_private"
              checked={!state.process_private}
              onSelect={() => update("process_private", false)}
              label="상관없음"
            />
            <RadioPill
              name="process_private"
              checked={state.process_private}
              onSelect={() => update("process_private", true)}
              label="비공개"
            />
          </div>
        </div>

        <div className="l2d-form-group">
          <span className="l2d-form-label">
            포트폴리오 비공개 <span className="l2d-form-req">*</span>
          </span>
          <div className="l2d-radio-row">
            <RadioPill
              name="portfolio_private"
              checked={!state.portfolio_private}
              onSelect={() => update("portfolio_private", false)}
              label="상관없음"
            />
            <RadioPill
              name="portfolio_private"
              checked={state.portfolio_private}
              onSelect={() => update("portfolio_private", true)}
              label="비공개"
            />
          </div>
        </div>
      </div>

      {/* 신청 타입 */}
      <div className="l2d-form-group">
        <span className="l2d-form-label">
          신청 타입 <span className="l2d-form-req">*</span>
        </span>
        <div className="l2d-radio-row">
          {APPLICATION_TYPE_OPTIONS.map((opt) => (
            <RadioPill
              key={opt.value}
              name="application_type"
              checked={state.application_type === opt.value}
              onSelect={() => update("application_type", opt.value)}
              label={opt.label}
            />
          ))}
        </div>
        {errors.application_type && (
          <p className="l2d-form-msg">{errors.application_type}</p>
        )}
      </div>

      {/* 서술형 — 신청 캐릭터 + 이미지 첨부 */}
      <div className="l2d-form-group">
        <label htmlFor="l2d-character" className="l2d-form-label">
          신청 캐릭터 <span className="l2d-form-req">*</span>
        </label>
        <p className="l2d-form-hint">
          아직 정해지지 않았다면 대략적인 느낌이나 자료를 적어주세요
        </p>
        <textarea
          id="l2d-character"
          rows={4}
          className={`l2d-form-textarea${errors.character_description ? " l2d-form-input-err" : ""}`}
          value={state.character_description}
          onChange={(e) => update("character_description", e.target.value)}
        />
        {errors.character_description && (
          <p className="l2d-form-msg">{errors.character_description}</p>
        )}

        <div className="l2d-form-image-attach">
          <label
            className={`l2d-form-image-btn${canAddImage ? "" : " l2d-form-image-btn-disabled"}`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={!canAddImage}
              onChange={handleImageSelect}
            />
            📎 이미지 첨부 ({images.length}/{MAX_IMAGES})
          </label>

          {images.length > 0 && (
            <ul className="l2d-form-image-list">
              {images.map((img) => (
                <li key={img.id} className="l2d-form-image-item">
                  {/* dataURL 미리보기. 실제 업로드는 추후 Supabase Storage 연동 단계에서 처리 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.previewUrl} alt="첨부 미리보기" />
                  <button
                    type="button"
                    className="l2d-form-image-remove"
                    onClick={() => removeImage(img.id)}
                    aria-label="첨부 이미지 제거"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="l2d-form-group">
        <label htmlFor="l2d-additional" className="l2d-form-label">
          추가사항
          <span className="l2d-form-optional">(선택)</span>
        </label>
        <textarea
          id="l2d-additional"
          rows={3}
          className="l2d-form-textarea"
          value={state.additional_notes}
          onChange={(e) => update("additional_notes", e.target.value)}
        />
      </div>

      {submitError && (
        <p className="l2d-form-msg l2d-form-msg-top">{submitError}</p>
      )}

      <div className="l2d-form-actions">
        <button
          type="submit"
          className="l2d-form-submit"
          disabled={submitting}
        >
          {uploadingImages
            ? "이미지 업로드 중..."
            : submitting
              ? "제출 중..."
              : "제출"}
        </button>
      </div>
    </form>
  );
}

function RadioPill({
  name,
  checked,
  onSelect,
  label,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <label className={`l2d-radio${checked ? " l2d-radio-active" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} />
      <span>{label}</span>
    </label>
  );
}

