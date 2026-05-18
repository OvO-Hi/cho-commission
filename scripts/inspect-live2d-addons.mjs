// One-shot inspect: copyright_rules KO labels.
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
  .from("copyright_rules")
  .select("id, label, order_num")
  .order("order_num", { ascending: true });

if (error) {
  console.error("Query failed:", error);
  process.exit(1);
}

console.log(`Total rows: ${data.length}\n`);
for (const r of data) {
  console.log(`order=${r.order_num} id=${r.id} | "${r.label}"`);
}
