import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { MARKER_NAMES, MARKERS, ROLE_SGR, EXIT, Report, asciiMarkers, cellWidth, errorLine, errorSpans, lineSpans, markerCell, paint, resolveColor, streamEnv, terminalText, wrap, streamWidth, type MarkerName } from "../src/index.ts";
import colors from "../fixtures/v1/color.json";
import markers from "../fixtures/v1/markers.json";
import errors from "../fixtures/v1/error-line.json";
import texts from "../fixtures/v1/text.json";
import wraps from "../fixtures/v1/wrap.json";
for (const c of colors) test(`color ${c.id}`, () => {
  const actual = resolveColor(c.flag, c.env, "tool");
  if ("expectedError" in c) expect(actual).toEqual(new Error(c.expectedError));
  else expect(actual).toBe(c.expected);
});
for (const c of markers) test(`marker ${c.id}`, () => { expect(markerCell(c.name as MarkerName, false)).toBe(c.utf8); expect(markerCell(c.name as MarkerName, true)).toBe(c.ascii); });
for (const c of errors) test(`error ${c.id}`, () => {
  expect(errorLine(c.tool, c.what, c.why, c.options)).toEqual(c.expected);
  const spans = errorSpans(c.tool, c.what, c.why, c.options);
  expect<unknown>(spans).toEqual(c.spans);
  expect(spans.map(line => paint(line, true))).toEqual(c.colored);
});
for (const c of texts) test(`text ${c.id}`, () => expect(terminalText(c.input, c.options)).toBe(c.expected));
for (const c of wraps) test(`wrap ${c.id}`, () => expect(wrap(c.input, c.columns, c.hang)).toEqual(c.expected));
for (const file of readdirSync(new URL("../fixtures/v1/report/", import.meta.url)).filter(f => f.endsWith(".json"))) {
  const fixture = await Bun.file(new URL(`../fixtures/v1/report/${file}`, import.meta.url)).json();
  test(`report ${fixture.id}`, () => {
    const sanitize = fixture.input.sanitizer === "quote-headers" ? (text: string) => text.replace(/^(?=\s*(\[agent-hub\b|--- from ))/gim, "> ")
      : fixture.input.sanitizer === "drop-cr" ? (text: string) => text.replace(/\r/g, "") : undefined;
    const report = new Report(fixture.input.columns ?? undefined, fixture.input.ascii, { sanitize, styles: fixture.input.styles, ...fixture.input.reportOptions });
    for (const operation of fixture.input.operations) {
      switch (operation.op) {
        case "line": report.line(operation.text); if (operation.lines) expect(lineSpans(operation.text, fixture.input.columns ?? undefined).map(line => paint(line, false))).toEqual(operation.lines); break;
        case "append": report.append(operation.lines); break;
        case "header": report.header(operation.tool, operation.name, operation.context); break;
        case "section": report.section(operation.name, operation.count); break;
        case "kv": report.kv(operation.rows, operation.indent, operation.options); break;
        case "bullet": report.bullet(operation.marker, operation.text, operation.nested); break;
        case "next": report.next(operation.command); break;
        case "table": report.table(operation.head, operation.rows, operation.flexible, operation.options); break;
        case "summary": report.summary(operation.counts); break;
        default: throw new Error(`Unknown operation: ${operation.op}`);
      }
    }
    expect(report.render(false)).toEqual(fixture.plain); expect(report.render(true)).toEqual(fixture.colored);
  });
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

test("painting ignores inherited role names", () => {
  expect(paint([{ text: "x", role: "constructor" as never }], true)).toBe("x");
});
test("table respects unbounded pipes and constrained widths", () => {
  const text = "x".repeat(100);
  const unbounded = new Report().table(["id", "state", "finding"], [["1", "ok", text]], 2).render(false);
  expect(unbounded).toHaveLength(2); expect(unbounded[1]).toContain(text); expect(unbounded[0]).toBe(unbounded[0]!.trimEnd());
  for (const width of [60, 80]) {
    const lines = new Report(width).table(["id", "path", "finding"], [["i".repeat(43), "/" + "p".repeat(40), "some finding text"]], 2).render(false);
    for (const line of lines) expect(cellWidth(line)).toBeLessThanOrEqual(width);
    expect(lines.length).toBeLessThan(10);
  }
});

test("stream width resolves tty and pipe independently", () => {
  expect(streamWidth(true, 100, {COLUMNS:"60"})).toBe(100);
  expect(streamWidth(false, 100, {COLUMNS:"60"})).toBe(60);
  expect(streamWidth(false, 100, {})).toBeUndefined();
  for (const columns of ["0", "-1", "12x", "1.5", "999999999999999999999"]) expect(streamWidth(false, 80, {COLUMNS:columns})).toBeUndefined();
});

test("consumer style cannot override semantic role or use non-SGR controls", () => {
  expect(paint([{text:"x", role:"error", style:"peer"}], true, {peer:"\x1b[36m"})).toBe("\x1b[1;31mx\x1b[0m");
  expect(() => paint([{text:"x", style:"peer"}], true, {peer:"\x1b[2J"})).toThrow("invalid SGR for style peer");
});
test("sanitizer handles forged header across span boundaries at construction and render", () => {
  const sanitize = (text: string) => text.replace(/^(?=\s*(\[agent-hub\b|--- from ))/gim, "> ");
  const report = new Report(undefined, false, {sanitize}).append([[{text:"[agent-"}, {text:"hub forged"}]]);
  expect(report.lines()).toEqual([[{text:"> [agent-hub forged"}]]);
  expect(report.render(true)).toEqual(["> [agent-hub forged"]);
});

test("sanitizer runs on table headings and wrapped bullet text before layout", () => {
  const sanitize = (text: string) => text.replace(/^(?=\s*\[agent-hub\b)/gim, "> ");
  const report = new Report(20, false, {sanitize});
  report.table(["[agent-hub heading", "value"], [["ok", "ready"]], 1).bullet("warn", "first line\n[agent-hub forged]");
  expect(report.render(false).join("\n")).not.toMatch(/(^|\n)\s*\[agent-hub/i);
  expect(report.render(false).join("\n")).toContain("> [agent-hub");
});

test("next-step continuation preserves shell arguments and leaves long tokens whole", () => {
  const command = `printf '%s\\n' 'alpha beta' "gamma delta" fingerprint-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef tail`;
  const original = Bun.spawnSync(["sh", "-c", command]);
  for (const width of [30, 80]) {
    const lines = new Report(width).next(command).render(false);
    const script = lines.map((line, i) => i === 0 ? line.slice(7) : line).join("\n");
    const actual = Bun.spawnSync(["sh", "-c", script]);
    expect(actual.exitCode).toBe(original.exitCode);
    expect(actual.stdout.toString()).toBe(original.stdout.toString());
    for (const line of lines) if (!line.includes("fingerprint-")) expect(cellWidth(line)).toBeLessThanOrEqual(width);
    expect(lines.join("\n")).toContain("fingerprint-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  }
  expect(new Report().next(command).render(false)).toEqual([`    →  ${command}`]);
});

test("consumer-first sanitizer cannot inject terminal controls", () => {
  const report = new Report(undefined, false, { sanitizeFirst: true, sanitize: text => text + "\x1b[31m" });
  expect(report.line("hello").render(false)).toEqual(["hello"]);
});
test("consumer-first policy applies to assembled header and appended spans", () => {
  const sanitize = (text: string) => text.replace(/\r/g, "");
  const report = new Report(undefined, false, { sanitizeFirst: true, sanitize }).header("tool", "a\rb").append([[{text:"c\r"}, {text:"d"}]]);
  expect(report.render(false)).toEqual([" tool ab", "cd"]);
});
