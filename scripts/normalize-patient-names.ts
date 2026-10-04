import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// One-off maintenance script. Intentionally spans ALL clinics (no clinicId filter).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function fetchAllPatients() {
  const all: { id: string; patientId: string; name: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("patients")
      .select("id, patientId, name")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE_SIZE) return all;
  }
}

async function main() {
  const patients = await fetchAllPatients();
  console.log(`Found ${patients.length} patient records.\n`);

  let updated = 0;
  for (const patient of patients) {
    const normalized = toTitleCase(patient.name);
    if (normalized !== patient.name) {
      const { error } = await supabase
        .from("patients")
        .update({ name: normalized, updatedAt: new Date().toISOString() })
        .eq("id", patient.id);
      if (error) throw error;
      console.log(`  [${patient.patientId}] "${patient.name}" → "${normalized}"`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} of ${patients.length} records.`);
}

main().catch((e) => {
  console.error("Failed to normalize patient names:", e);
  process.exit(1);
});
