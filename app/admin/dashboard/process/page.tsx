import ProcessManager from "@/components/admin/ProcessManager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminProcessPage() {
  const supabase = createClient();

  const [stepsRes, typesRes, typeItemsRes] = await Promise.all([
    supabase
      .from("process_steps")
      .select("*")
      .eq("language", "ko")
      .order("step_num", { ascending: true }),
    supabase
      .from("live2d_types")
      .select("*")
      .eq("language", "ko")
      .order("order_num", { ascending: true }),
    supabase
      .from("live2d_type_items")
      .select("*")
      .order("order_num", { ascending: true }),
  ]);

  if (stepsRes.error) {
    console.error("[admin/process] fetch steps failed:", stepsRes.error.message);
  }
  if (typesRes.error) {
    console.error("[admin/process] fetch types failed:", typesRes.error.message);
  }
  if (typeItemsRes.error) {
    console.error(
      "[admin/process] fetch type items failed:",
      typeItemsRes.error.message,
    );
  }

  return (
    <ProcessManager
      initialSteps={stepsRes.data ?? []}
      initialTypes={typesRes.data ?? []}
      initialTypeItems={typeItemsRes.data ?? []}
    />
  );
}
