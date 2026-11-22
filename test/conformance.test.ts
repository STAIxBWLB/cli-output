import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { MARKER_NAMES, MARKERS, ROLE_SGR, EXIT, Report, asciiMarkers, cellWidth, errorLine, markerCell, paint, resolveColor, streamEnv, terminalText, wrap, type MarkerName } from "../src/index.ts";
import colors from "../fixtures/v1/color.json";
import markers from "../fixtures/v1/markers.json";
import errors from "../fixtures/v1/error-line.json";
for (const c of colors) test(`color ${c.id}`, () => expect(resolveColor(c.flag, c.env, "tool")).toBe(c.expected));
for (const c of markers) test(`marker ${c.id}`, () => { expect(markerCell(c.name as MarkerName, false)).toBe(c.utf8); expect(markerCell(c.name as MarkerName, true)).toBe(c.ascii); });
for (const c of errors) test(`error ${c.id}`, () => expect(errorLine(c.tool, c.what, c.why, c.options)).toEqual(c.expected));
for (const file of readdirSync(new URL("../fixtures/v1/report/", import.meta.url)).filter(f => f.endsWith(".json"))) {
  const fixture = await Bun.file(new URL(`../fixtures/v1/report/${file}`, import.meta.url)).json();
  test(`report ${fixture.id}`, () => { const i = fixture.input; const report = new Report(80).header(i.tool, i.title).section(i.section).bullet(i.marker, i.text).summary({ ok: 1 }); expect(report.render(false)).toEqual(fixture.plain); expect(report.render(true)).toEqual(fixture.colored); });
}
test("library conformance", () => {
  expect(paint([{text:"failed",role:"error"}], false)).toBe("failed");
  expect(paint([{text:"failed",role:"error"}], true)).toBe(ROLE_SGR.error + "failed" + "\x1b[0m");
  expect(new Report().bullet("fail", "failed").render(false)[0]).toContain("failed");
  for (const name of MARKER_NAMES) for (const ascii of [true, false]) expect(cellWidth(markerCell(name, ascii))).toBe(2);
  expect(errorLine("tool", "failed", "why", {tty:false})[0]).toBe("tool: failed: why");
  expect(EXIT).toEqual({ok:0,fail:1,usage:2,tempfail:75});
  expect(asciiMarkers({LANG:"C"})).toBe(true);
  for (const glyph of ["✓", "✗", "⚠", "→", "▸"]) expect(cellWidth(glyph)).toBe(1);
  for (const line of wrap("한글 단어 ✓ ✗ ⚠ → ▸ 한글 단어", 12, 0)) expect(cellWidth(line)).toBeLessThanOrEqual(12);
  expect(terminalText("x\x1b[31my")).toBe("xy");
  expect(resolveColor("bad", streamEnv(true, {}), "tool")).toEqual(new Error("usage: tool <command> [--color=auto|always|never]"));
  expect(Object.keys(MARKERS)).toEqual([...MARKER_NAMES]);
});
test("table caps non-flexible columns and drops empty columns", () => {
  const rows = new Report(80).table(["path", "empty", "finding"], [["/a/" + "x".repeat(50) + "/end", "", "한글 finding"]], 2).render(false);
  expect(rows[0]).not.toContain("EMPTY");
  expect(rows[1]).toContain("...");
  for (const line of rows) expect(cellWidth(line)).toBeLessThanOrEqual(80);
});

test("reference marker table parity", () => {
  expect(MARKERS).toEqual({
    ok: { glyph: "✓", ascii: "ok", role: "success" }, fail: { glyph: "✗", ascii: "x", role: "error" }, warn: { glyph: "⚠", ascii: "!", role: "warning" },
    absent: { glyph: "-", ascii: "-", role: "hint" }, unknown: { glyph: "?", ascii: "?", role: "hint" }, pending: { glyph: "~", ascii: "~", role: "hint" },
    active: { glyph: "*", ascii: "*", role: "success" }, next: { glyph: "→", ascii: "->", role: "accent" },
  });
});
test("reference color table parity", () => {
  const tty = { isTTY: true }, pipe = { isTTY: false };
  const cases: [string | undefined, typeof tty & Record<string, string | boolean>, boolean][] = [
    ["never", {...tty, FORCE_COLOR:"1"}, false], ["always", {...pipe, NO_COLOR:"1", TERM:"dumb"}, true],
    [undefined, {...tty, NO_COLOR:"1"}, false], ["auto", {...tty, NO_COLOR:"1", FORCE_COLOR:"1"}, false], [undefined, {...pipe, NO_COLOR:"1", CLICOLOR_FORCE:"1"}, false], [undefined, {...tty, NO_COLOR:""}, true],
    [undefined, {...pipe, FORCE_COLOR:"1"}, true], [undefined, {...pipe, FORCE_COLOR:"true"}, true], [undefined, {...pipe, CLICOLOR_FORCE:"1"}, true], [undefined, {...pipe, TERM:"dumb", FORCE_COLOR:"1"}, true], [undefined, {...pipe, FORCE_COLOR:""}, false], [undefined, {...pipe, CLICOLOR_FORCE:"0"}, false],
    [undefined, {...tty, FORCE_COLOR:"0"}, false], [undefined, {...tty, CLICOLOR:"0"}, false], [undefined, {...tty, CLICOLOR:"1"}, true], [undefined, {...pipe, FORCE_COLOR:"0", CLICOLOR_FORCE:"1"}, true],
    [undefined, tty, true], ["auto", {...tty, TERM:"xterm-256color"}, true], [undefined, {...tty, TERM:"dumb"}, false], [undefined, pipe, false], ["auto", {...pipe, TERM:"xterm"}, false],
  ];
  for (const [flag, env, expected] of cases) expect(resolveColor(flag, env, "tool")).toBe(expected);
});
