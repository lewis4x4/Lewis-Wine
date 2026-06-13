import { readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const prefixes = new Map<string, string[]>();
for (const file of files) {
  const prefix = file.match(/^(\d+)_/)?.[1];
  if (!prefix) {
    console.error(`Invalid migration filename: ${file}`);
    process.exitCode = 1;
    continue;
  }
  prefixes.set(prefix, [...(prefixes.get(prefix) ?? []), file]);
}

for (const [prefix, matches] of prefixes) {
  if (matches.length > 1) {
    console.error(`Duplicate migration prefix ${prefix}: ${matches.join(", ")}`);
    process.exitCode = 1;
  }
}

const sorted = [...files].sort((a, b) => a.localeCompare(b));
if (files.join("\n") !== sorted.join("\n")) {
  console.error("Migration filenames are not in stable lexical order.");
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(`OK: ${files.length} migrations have unique numeric prefixes.`);
}
