import SamplesManager from "@/components/admin/SamplesManager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSamplesPage() {
  const supabase = createClient();

  // 두 카테고리(live2d/illust) 의 모든 블록 + 모든 이미지를 한 번에 가져와
  // 클라이언트에서 카테고리/블록별로 그룹화. 블록 수가 많지 않은 도메인이라 OK.
  const [blocksRes, imagesRes] = await Promise.all([
    supabase
      .from("sample_blocks")
      .select("*")
      .order("order_num", { ascending: true }),
    supabase
      .from("sample_images")
      .select("*")
      .order("order_num", { ascending: true }),
  ]);

  if (blocksRes.error) {
    console.error("[admin/samples] fetch blocks failed:", blocksRes.error.message);
  }
  if (imagesRes.error) {
    console.error("[admin/samples] fetch images failed:", imagesRes.error.message);
  }

  return (
    <SamplesManager
      initialBlocks={blocksRes.data ?? []}
      initialImages={imagesRes.data ?? []}
    />
  );
}
