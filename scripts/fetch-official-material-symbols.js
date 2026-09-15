import fs from "fs";

const ICONS = [
  "water_drop",
  "ecg_heart",
  "shield_with_heart",
  "syringe",
  "bolt",
  "restaurant",
  "directions_walk",
  "directions_run",
  "shopping_basket",
  "pill",
  "medication",
  "medication_liquid",
  "schedule",
  "history",
  "hourglass_empty",
  "search",
  "arrow_back",
  "arrow_forward",
  "chevron_right",
  "chevron_left",
  "close",
  "add",
  "add_circle",
  "delete",
  "bookmarks",
  "info",
  "warning",
  "check",
  "check_circle",
  "palette",
  "auto_awesome",
  "brightness_auto",
  "light_mode",
  "dark_mode",
  "settings",
  "analytics",
  "calculate",
  "menu_book",
  "cloud_sync",
  "terminal",
  "arrow_circle_up",
  "arrow_circle_down",
  "bakery_dining",
  "egg",
  "south",
  "trending_up",
  "tune",
  "inventory_2",
  "lock",
  "public",
  "key",
  "health_and_safety",
  "refresh",
  "sync",
  "edit_note",
  "drag_handle",
  "more_vert",
  "more_horiz",
  "expand_more",
  "expand_less",
];

async function fetchIcon(name) {
  const baseUrl = `https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/${name}/materialsymbolsrounded`;
  
  // Try outline
  const outlineUrl = `${baseUrl}/${name}_24px.svg`;
  const fillUrl = `${baseUrl}/${name}_fill1_24px.svg`;

  let outlinePath = "";
  let fillPath = "";

  try {
    const resOutline = await fetch(outlineUrl);
    if (resOutline.ok) {
      const svgText = await resOutline.text();
      const match = svgText.match(/d="([^"]+)"/);
      if (match) outlinePath = match[1];
    } else {
      console.warn(`[WARN] Outline not found for ${name}: ${resOutline.status}`);
    }
  } catch (e) {
    console.error(`Error fetching outline for ${name}:`, e.message);
  }

  try {
    const resFill = await fetch(fillUrl);
    if (resFill.ok) {
      const svgText = await resFill.text();
      const match = svgText.match(/d="([^"]+)"/);
      if (match) fillPath = match[1];
    }
  } catch (e) {
    // Fill might not exist for some glyphs, which is fine
  }

  return { outline: outlinePath, fill: fillPath || outlinePath };
}

async function main() {
  console.log(`Fetching ${ICONS.length} official Google Material Symbols Rounded icons...`);
  const results = {};

  for (const icon of ICONS) {
    process.stdout.write(`Fetching ${icon}... `);
    const data = await fetchIcon(icon);
    if (data.outline) {
      results[icon] = data;
      console.log(`OK (fill: ${data.fill !== data.outline ? "yes" : "same"})`);
    } else {
      console.log(`FAILED`);
    }
  }

  // Also add aliases
  results["drop_water"] = results["water_drop"];

  fs.writeFileSync(
    "scripts/official_material_symbols.json",
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log(`Done! Saved ${Object.keys(results).length} icons to scripts/official_material_symbols.json`);
}

main();
