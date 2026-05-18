// One-shot: live2d main rows (all languages) + KO addon rows for migration design.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await supabase
  .from("price_items")
  .select("id, item_name, price, is_addon, language, translation_key, order_num")
  .eq("category", "live2d")
  .eq("is_addon", false)
  .order("translation_key", { ascending: true })
  .order("language", { ascending: true });

if (error) {
  console.error("Query failed:", error);
  process.exit(1);
}

console.log(`Total live2d main rows (all langs): ${data.length}\n`);
for (const r of data) {
  console.log(
    `${r.language} | order=${r.order_num} | "${r.item_name}" | tk=${r.translation_key?.slice(0, 8)}`,
  );
}
