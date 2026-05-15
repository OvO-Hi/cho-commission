import { createClient } from "@/lib/supabase/client";

// Supabase Storage 에 만들어 둘 버킷 이름 컨벤션.
//  - commission-images : 신청 폼 첨부
//  - banners           : 메인 페이지 배너
//  - samples           : 샘플 페이지 이미지
export type StorageBucket = "commission-images" | "banners" | "samples";

export type UploadResult = {
  url: string;
  path: string;
};

// 충돌 방지용 파일명. timestamp + 8자 random + 원본 확장자.
function generateFilename(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const ext =
    dot >= 0 ? originalName.slice(dot + 1).toLowerCase() : "bin";
  const safeExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}.${safeExt}`;
}

// 단일 파일 업로드 → 공개 URL 과 storage path 반환.
// 실패 시 null. 호출자에서 부분 실패 처리 (예: 폼에서 cleanup) 를 담당하도록 throw 하지 않음.
export async function uploadImage(
  file: File,
  bucket: StorageBucket,
  folder?: string,
): Promise<UploadResult | null> {
  const supabase = createClient();
  const filename = generateFilename(file.name);
  const path = folder ? `${folder}/${filename}` : filename;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    // 가장 흔한 실패 원인:
    //   - "Bucket not found" → 버킷 미생성
    //   - "new row violates row-level security policy" → RLS INSERT 권한 미부여
    //   - "The resource already exists" → 동일 path 중복(랜덤 충돌, 거의 없음)
    console.error("[storage/upload] ERROR:", {
      message: error.message,
      name: error.name,
      raw: JSON.stringify(error, null, 2),
    });
    return null;
  }

  if (!data) {
    console.error("[storage/upload] upload returned null data without error");
    return null;
  }

  const { data: pub } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return { url: pub.publicUrl, path: data.path };
}

// public URL → storage path 추출. DB 가 image_url(공개 URL) 만 보관하는 테이블의
// 정리 용도(예: 배너 교체 시 이전 파일 삭제) 에 사용합니다.
// URL 패턴: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
export function extractStoragePath(
  url: string,
  bucket: StorageBucket,
): string | null {
  const marker = `/${bucket}/`;
  const idx = url.lastIndexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length);
}

// 단일 파일 삭제. 실패 시 false 반환 (조용히 실패 — 정합성보다 가용성 우선).
export async function deleteImage(
  bucket: StorageBucket,
  path: string,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error("[storage/delete] failed:", bucket, path, {
      message: error.message,
      raw: JSON.stringify(error, null, 2),
    });
    return false;
  }
  return true;
}
