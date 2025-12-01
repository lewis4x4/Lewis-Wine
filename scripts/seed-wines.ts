/**
 * Wine Database Seed Script
 *
 * Imports ~130,000 wines from the WineEnthusiast Kaggle dataset
 * into the Supabase wine_reference table.
 *
 * Usage: npm run db:seed
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error("\n⚠️  Missing SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nTo run this seed script, add to your .env.local:");
  console.error("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here");
  console.error("\nFind it at: https://supabase.com/dashboard/project/ewzdtfgfeawnkxekqvfn/settings/api");
  console.error("Look for 'service_role' under 'Project API keys'\n");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface WineCSVRow {
  "": string; // index
  country: string;
  description: string;
  designation: string;
  points: string;
  price: string;
  province: string;
  region_1: string;
  region_2: string;
  taster_name: string;
  taster_twitter_handle: string;
  title: string;
  variety: string;
  winery: string;
}

interface WineReference {
  name: string;
  producer: string | null;
  region: string | null;
  sub_region: string | null;
  country: string | null;
  grape_varieties: string[] | null;
  wine_type: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null;
  critic_scores: Record<string, unknown>;
}

// Map grape varieties to wine types
function inferWineType(variety: string): WineReference["wine_type"] {
  const v = variety.toLowerCase();

  // Sparkling
  if (v.includes("champagne") || v.includes("prosecco") || v.includes("cava") ||
      v.includes("sparkling") || v.includes("crémant")) {
    return "sparkling";
  }

  // Rosé
  if (v.includes("rosé") || v.includes("rose") || v === "rosato") {
    return "rose";
  }

  // Dessert/Fortified
  if (v.includes("port") || v.includes("sherry") || v.includes("madeira") ||
      v.includes("moscato") || v.includes("ice wine") || v.includes("late harvest")) {
    return "dessert";
  }

  // Common white varieties
  const whites = [
    "chardonnay", "sauvignon blanc", "riesling", "pinot grigio", "pinot gris",
    "gewürztraminer", "viognier", "albariño", "grüner veltliner", "chenin blanc",
    "white blend", "trebbiano", "vermentino", "muscadet", "sémillon",
    "müller-thurgau", "torrontés", "verdejo", "fiano", "arneis", "cortese",
    "verdicchio", "friulano", "garganega", "pecorino", "greco", "falanghina",
    "malvasia", "marsanne", "roussanne", "melon", "silvaner", "scheurebe"
  ];
  if (whites.some(w => v.includes(w))) {
    return "white";
  }

  // Common red varieties
  const reds = [
    "cabernet sauvignon", "merlot", "pinot noir", "syrah", "shiraz",
    "zinfandel", "malbec", "tempranillo", "sangiovese", "nebbiolo",
    "barbera", "primitivo", "grenache", "mourvèdre", "petite sirah",
    "carménère", "red blend", "bordeaux", "rioja", "chianti",
    "barolo", "brunello", "amarone", "valpolicella", "montepulciano",
    "nero d'avola", "aglianico", "dolcetto", "corvina", "tannat",
    "pinotage", "touriga", "gamay", "mencía", "carignan"
  ];
  if (reds.some(r => v.includes(r))) {
    return "red";
  }

  // Default based on common patterns
  if (v.includes("red") || v.includes("rouge") || v.includes("tinto") || v.includes("rosso")) {
    return "red";
  }
  if (v.includes("white") || v.includes("blanc") || v.includes("bianco")) {
    return "white";
  }

  return null;
}

// Parse vintage year from title (e.g., "Château Margaux 2015 Grand Vin")
function parseVintage(title: string): number | null {
  const match = title.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

// Parse wine name from title (remove vintage and winery if at start)
function parseWineName(title: string, winery: string): string {
  let name = title;
  // Remove vintage year
  name = name.replace(/\b(19|20)\d{2}\b/, "").trim();
  // Remove winery name from start if present
  if (name.toLowerCase().startsWith(winery.toLowerCase())) {
    name = name.slice(winery.length).trim();
  }
  // Clean up extra spaces and parentheses content at end (region info)
  name = name.replace(/\s+/g, " ").trim();
  return name || title;
}

async function seedWines() {
  const csvPath = path.join(process.cwd(), "archive/winemag-data-130k-v2.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log("Reading CSV file...");

  const records: WineCSVRow[] = [];
  const parser = fs
    .createReadStream(csvPath)
    .pipe(parse({ columns: true, skip_empty_lines: true }));

  for await (const record of parser) {
    records.push(record as WineCSVRow);
  }

  console.log(`Parsed ${records.length} wine records`);

  // Transform to wine_reference format
  const wines: WineReference[] = records.map((row) => {
    const points = parseInt(row.points) || null;

    return {
      name: parseWineName(row.title, row.winery),
      producer: row.winery || null,
      region: row.region_1 || row.province || null,
      sub_region: row.region_2 || null,
      country: row.country || null,
      grape_varieties: row.variety ? [row.variety] : null,
      wine_type: inferWineType(row.variety || ""),
      critic_scores: points ? {
        wine_enthusiast: points,
        description: row.description || null,
        taster: row.taster_name || null,
      } : {},
    };
  });

  // Remove duplicates based on name + producer + country
  const seen = new Set<string>();
  const uniqueWines = wines.filter((wine) => {
    const key = `${wine.name}|${wine.producer}|${wine.country}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`${uniqueWines.length} unique wines after deduplication`);

  // Insert in batches
  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < uniqueWines.length; i += BATCH_SIZE) {
    const batch = uniqueWines.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("wine_reference")
      .insert(batch);

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }

    // Progress update every 10 batches
    if ((i / BATCH_SIZE) % 10 === 0) {
      const progress = ((i / uniqueWines.length) * 100).toFixed(1);
      console.log(`Progress: ${progress}% (${inserted} inserted, ${errors} errors)`);
    }
  }

  console.log("\n✅ Seeding complete!");
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Errors: ${errors}`);
}

seedWines().catch(console.error);
