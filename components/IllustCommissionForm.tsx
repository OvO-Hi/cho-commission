"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getFormMessages } from "@/lib/i18n/form-messages";
import {
  deleteImage,
  uploadImage,
  type UploadResult,
} from "@/lib/storage/upload";
import type { ApplicationType, Language } from "@/types/database";

// Live2DCommissionForm 과 거의 동일한 구조이지만 신청 타입 옵션과
// sessionStorage 키만 Illust 전용으로 분리한 폼입니다.
// 추후 두 폼을 묶어 공통 컴포넌트로 추출하는 리팩터 후보.

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
  file: File;
  previewUrl: string;
};

const INITIAL: FormState = {
  nickname: "",
  contact: "",
  desired_date: "",
  process_private: false,
  portfolio_private: false,
  application_type: "",
  character_description: "",
  additional_notes: "",
};

const MAX_IMAGES = 5;

export const ILLUST_SUBMISSION_KEY = "illust_submission";
export const ILLUST_IMAGES_KEY = "illust_submission_images";

export default function IllustCommissionForm({ locale }: { locale: Language }) {
  const router = useRouter();
  const messages = getFormMessages(locale);
  const applicationTypeOptions: { value: ApplicationType; label: string }[] = [
    { value: "broadcast_bust", label: messages.broadcast_bust },
    { value: "broadcast_half", label: messages.broadcast_half },
    { value: "broadcast_full", label: messages.broadcast_full },
    { value: "commercial_with_bg", label: messages.commercial_with_bg },
    { value: "commercial_no_bg", label: messages.commercial_without_bg },
  ];
  const [state, setState] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
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
    if (!state.nickname.trim()) next.nickname = messages.validation_nickname;
    if (!state.contact.trim()) next.contact = messages.validation_contact;
    if (!state.application_type)
      next.application_type = messages.validation_type;
    if (!state.character_description.trim())
      next.character_description = messages.validation_character;
    return next;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting) {
      console.warn("[illust-form] submit already in progress, ignoring");
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      console.warn(
        "[illust-form] validation failed:",
        Object.keys(validationErrors),
      );
      setErrors(validationErrors);
      setSubmitError(null);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setErrors({});

    let uploadedUrls: string[] = [];
    if (images.length > 0) {
      setUploadingImages(true);

      let results: (UploadResult | null)[];
      try {
        results = await Promise.all(
          images.map((img) =>
            uploadImage(img.file, "commission-images", "illust"),
          ),
        );
      } catch (err) {
        console.error("[illust-form] upload threw unexpectedly:", err);
        setUploadingImages(false);
        setSubmitError(messages.submit_error_upload_exception);
        setSubmitting(false);
        return;
      }
      setUploadingImages(false);

      const successful = results.filter(
        (r): r is UploadResult => r !== null,
      );
      if (successful.length !== images.length) {
        console.error(
          "[illust-form] PARTIAL FAILURE — succeeded:",
          successful.length,
          "/",
          images.length,
        );
        await Promise.all(
          successful.map((r) =>
            deleteImage("commission-images", r.path),
          ),
        );
        setSubmitError(messages.submit_error_upload_partial);
        setSubmitting(false);
        return;
      }
      uploadedUrls = successful.map((r) => r.url);
    }

    const supabase = createClient();
    const payload = {
      type: "illust" as const,
      nickname: state.nickname.trim(),
      contact: state.contact.trim(),
      desired_date: state.desired_date.trim() || null,
      process_private: state.process_private,
      portfolio_private: state.portfolio_private,
      application_type: state.application_type as ApplicationType,
      character_description: state.character_description.trim(),
      additional_notes: state.additional_notes.trim() || null,
      is_read: false,
      admin_label: null,
      deadline: null,
      image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
    };

    const { error: insertError } = await supabase
      .from("commissions")
      .insert(payload);

    if (insertError) {
      console.error(
        "[illust-form] insert failed:",
        insertError.message,
        "details:",
        JSON.stringify(insertError, null, 2),
      );
      if (uploadedUrls.length > 0) {
        console.warn(
          "[illust-form] insert 실패 — 업로드된 이미지가 orphan 됩니다:",
          uploadedUrls,
        );
      }
      setSubmitError(messages.submit_error_generic);
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
            created_at: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("[illust-form] notify fetch threw:", err);
      }
    })();

    try {
      sessionStorage.setItem(
        ILLUST_SUBMISSION_KEY,
        JSON.stringify({ ...payload, submitted_at: new Date().toISOString() }),
      );
    } catch (err) {
      console.error("[illust-form] sessionStorage submission save failed:", err);
    }

    if (uploadedUrls.length > 0) {
      try {
        sessionStorage.setItem(
          ILLUST_IMAGES_KEY,
          JSON.stringify(uploadedUrls),
        );
      } catch (err) {
        console.error("[illust-form] sessionStorage images save failed:", err);
      }
    } else {
      try {
        sessionStorage.removeItem(ILLUST_IMAGES_KEY);
      } catch (err) {
        console.error("[illust-form] sessionStorage images remove failed:", err);
      }
    }

    router.push("/illust/complete");
  }

  const canAddImage = images.length < MAX_IMAGES;

  return (
    <form className="l2d-form" onSubmit={handleSubmit} noValidate>
      <div className="l2d-form-row">
        <div className="l2d-form-group">
          <label htmlFor="ill-nickname" className="l2d-form-label">
            {messages.nickname} <span className="l2d-form-req">*</span>
          </label>
          <input
            id="ill-nickname"
            type="text"
            className={`l2d-form-input${errors.nickname ? " l2d-form-input-err" : ""}`}
            placeholder={messages.nickname_placeholder}
            value={state.nickname}
            onChange={(e) => update("nickname", e.target.value)}
          />
          {errors.nickname && <p className="l2d-form-msg">{errors.nickname}</p>}
        </div>

        <div className="l2d-form-group">
          <label htmlFor="ill-contact" className="l2d-form-label">
            {messages.contact} <span className="l2d-form-req">*</span>
          </label>
          <input
            id="ill-contact"
            type="text"
            className={`l2d-form-input${errors.contact ? " l2d-form-input-err" : ""}`}
            placeholder={messages.contact_placeholder}
            value={state.contact}
            onChange={(e) => update("contact", e.target.value)}
          />
          <p className="l2d-form-hint">{messages.contact_help}</p>
          {errors.contact && <p className="l2d-form-msg">{errors.contact}</p>}
        </div>
      </div>

      <div className="l2d-form-group">
        <label htmlFor="ill-date" className="l2d-form-label">
          {messages.desired_date}
          <span className="l2d-form-optional">({messages.optional_label})</span>
        </label>
        <input
          id="ill-date"
          type="text"
          className="l2d-form-input l2d-form-input-narrow"
          placeholder={messages.desired_date_placeholder}
          value={state.desired_date}
          onChange={(e) => update("desired_date", e.target.value)}
        />
      </div>

      <div className="l2d-form-row">
        <div className="l2d-form-group">
          <span className="l2d-form-label">
            {messages.work_process_private}{" "}
            <span className="l2d-form-req">*</span>
          </span>
          <div className="l2d-radio-row">
            <RadioPill
              name="process_private"
              checked={!state.process_private}
              onSelect={() => update("process_private", false)}
              label={messages.no_preference}
            />
            <RadioPill
              name="process_private"
              checked={state.process_private}
              onSelect={() => update("process_private", true)}
              label={messages.private_label}
            />
          </div>
        </div>

        <div className="l2d-form-group">
          <span className="l2d-form-label">
            {messages.portfolio_private}{" "}
            <span className="l2d-form-req">*</span>
          </span>
          <div className="l2d-radio-row">
            <RadioPill
              name="portfolio_private"
              checked={!state.portfolio_private}
              onSelect={() => update("portfolio_private", false)}
              label={messages.no_preference}
            />
            <RadioPill
              name="portfolio_private"
              checked={state.portfolio_private}
              onSelect={() => update("portfolio_private", true)}
              label={messages.private_label}
            />
          </div>
        </div>
      </div>

      <div className="l2d-form-group">
        <span className="l2d-form-label">
          {messages.request_type} <span className="l2d-form-req">*</span>
        </span>
        <div className="l2d-radio-row">
          {applicationTypeOptions.map((opt) => (
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

      <div className="l2d-form-group">
        <label htmlFor="ill-character" className="l2d-form-label">
          {messages.request_character} <span className="l2d-form-req">*</span>
        </label>
        <p className="l2d-form-hint">{messages.character_placeholder}</p>
        <textarea
          id="ill-character"
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
            📎 {messages.image_attach} ({images.length}/{MAX_IMAGES})
          </label>

          {images.length > 0 && (
            <ul className="l2d-form-image-list">
              {images.map((img) => (
                <li key={img.id} className="l2d-form-image-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.previewUrl} alt={messages.image_preview_alt} />
                  <button
                    type="button"
                    className="l2d-form-image-remove"
                    onClick={() => removeImage(img.id)}
                    aria-label={messages.image_remove_aria}
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
        <label htmlFor="ill-additional" className="l2d-form-label">
          {messages.additional_notes}
          <span className="l2d-form-optional">({messages.optional_label})</span>
        </label>
        <textarea
          id="ill-additional"
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
        <button type="submit" className="l2d-form-submit" disabled={submitting}>
          {uploadingImages
            ? messages.uploading_images
            : submitting
              ? messages.submitting
              : messages.submit}
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

