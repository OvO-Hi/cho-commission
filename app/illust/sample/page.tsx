import Link from "next/link";

import BackToTopButton from "@/components/BackToTopButton";
import SamplePageRenderer, {
  type SampleBlockWithImages,
} from "@/components/SamplePageRenderer";
import ScrollProgress from "@/components/ScrollProgress";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { getPageMessages } from "@/lib/i18n/page-messages";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IllustSamplePage() {
  const supabase = createClient();
  const locale = await getCurrentLocale();
  const pageMessages = getPageMessages(locale);

  const [blocksRes, imagesRes] = await Promise.all([
    supabase
      .from("sample_blocks")
      .select("*")
      .eq("category", "illust")
      .order("order_num", { ascending: true }),
    supabase
      .from("sample_images")
      .select("*")
      .order("order_num", { ascending: true }),
  ]);

  if (blocksRes.error) {
    console.error("[illust/sample] fetch blocks failed:", blocksRes.error.message);
  }
  if (imagesRes.error) {
    console.error("[illust/sample] fetch images failed:", imagesRes.error.message);
  }

  const blocks = blocksRes.data ?? [];
  const allImages = imagesRes.data ?? [];

  const withImages: SampleBlockWithImages[] = blocks.map((b) => ({
    ...b,
    images:
      b.block_type === "image_row"
        ? allImages.filter((img) => img.block_id === b.id)
        : [],
  }));

  return (
    <main className="l2d-shell">
      <ScrollProgress />
      <BackToTopButton locale={locale} />
      <div className="l2d-container">
        <div className="l2d-topbar">
          <Link
            href="/illust"
            className="l2d-back"
            aria-label={pageMessages.back_to_apply_aria}
          >
            {pageMessages.back_to_apply}
          </Link>
        </div>

        <header className="l2d-hero l2d-sample-hero">
          <h1 className="l2d-hero-title">{pageMessages.illust_sample_title}</h1>
        </header>

        <SamplePageRenderer blocks={withImages} />
      </div>
    </main>
  );
}
