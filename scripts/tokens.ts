import { MARKERS, MARKER_NAMES, MARKER_COLUMN, ROLE_SGR, SECTION_MARKER, cellWidth } from "../src/index.ts";
const tokens = {
  standard: "v1",
  roles: Object.fromEntries(Object.entries(ROLE_SGR).map(([role, sgr]) => [role, sgr ? sgr.slice(2, -1) : ""])),
  markers: Object.fromEntries(MARKER_NAMES.map(name => [name, { ...MARKERS[name], width: cellWidth(MARKERS[name].glyph), asciiWidth: cellWidth(MARKERS[name].ascii) }])),
  sectionMarker: SECTION_MARKER,
  markerColumn: MARKER_COLUMN,
  colorPrecedence: ["flag never or always", "non-empty NO_COLOR disables", "non-empty FORCE_COLOR or CLICOLOR_FORCE other than 0 enables", "FORCE_COLOR=0 or CLICOLOR=0 disables", "TTY with TERM other than dumb enables", "otherwise disabled"],
};
const output = JSON.stringify(tokens, null, 2) + "\n";
const file = new URL("../tokens/v1.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (await Bun.file(file).text() !== output) { console.error("tokens/v1.json is stale"); process.exitCode = 1; }
} else await Bun.write(file, output);
