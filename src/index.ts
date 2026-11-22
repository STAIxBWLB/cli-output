// CLI output standard v1: semantic roles, markers, color, text and layout.
// Human-output code names a role or a marker, never an SGR code or a glyph literal.
/**
 * The nine semantic roles of CLI output standard v1 on the 16 ANSI colors, so a terminal theme decides the shades. Code names a role,
 * never an SGR code. `value` is the
 * default foreground and carries no SGR. Bold is only for `header`, `section` and the three status roles; no backgrounds.
 */
/** End of every painted span. */
export const SGR_RESET = "\x1b[0m";
export type Role = "header" | "section" | "key" | "value" | "success" | "warning" | "error" | "hint" | "accent";
export const ROLE_SGR: Readonly<Record<Role, string>> = Object.freeze({
  header: "\x1b[1;34m", section: "\x1b[1;35m", key: "\x1b[34m", value: "", success: "\x1b[1;32m", warning: "\x1b[1;33m", error: "\x1b[1;31m", hint: "\x1b[90m", accent: "\x1b[36m",
});
export const MARKER_NAMES = ["ok", "fail", "warn", "absent", "unknown", "pending", "active", "next"] as const;
export type MarkerName = (typeof MARKER_NAMES)[number];
/** Semantic glyphs, each with its ASCII form and the one role that colors it. Code names a marker, never a glyph literal. */
export const MARKERS: Readonly<Record<MarkerName, { glyph: string; ascii: string; role: Role }>> = Object.freeze({
  ok: { glyph: "✓", ascii: "ok", role: "success" }, fail: { glyph: "✗", ascii: "x", role: "error" }, warn: { glyph: "⚠", ascii: "!", role: "warning" },
  absent: { glyph: "-", ascii: "-", role: "hint" }, unknown: { glyph: "?", ascii: "?", role: "hint" }, pending: { glyph: "~", ascii: "~", role: "hint" },
  active: { glyph: "*", ascii: "*", role: "success" }, next: { glyph: "→", ascii: "->", role: "accent" },
});
export const SECTION_MARKER = { glyph: "▸", ascii: ">" } as const;
export const MARKER_COLUMN = 2;
/** Cells a string occupies: East Asian Ambiguous characters count as 1, so a Korean or CJK terminal keeps the same alignment. */
export const cellWidth = (text: string): number => Bun.stringWidth(text, { ambiguousIsNarrow: true });
/** A marker padded to the 2-cell marker column (ASCII `ok` and `->` fill it). */
export function markerCell(name: MarkerName, ascii: boolean): string {
  const text = ascii ? MARKERS[name].ascii : MARKERS[name].glyph;
  return text + " ".repeat(Math.max(0, MARKER_COLUMN - cellWidth(text)));
}
/** The environment one output stream's color decision reads (`streamEnv` builds it). */
export interface ColorEnv { isTTY: boolean; TERM?: string; NO_COLOR?: string; FORCE_COLOR?: string; CLICOLOR?: string; CLICOLOR_FORCE?: string }
/** `isTTY` of the stream that is decided (stdout and stderr are decided separately) plus the color variables of `env`. */
export function streamEnv(isTTY: boolean, env: Readonly<Record<string, string | undefined>> = process.env): ColorEnv {
  return { isTTY, TERM: env.TERM, NO_COLOR: env.NO_COLOR, FORCE_COLOR: env.FORCE_COLOR, CLICOLOR: env.CLICOLOR, CLICOLOR_FORCE: env.CLICOLOR_FORCE };
}
/**
 * Color for one stream, first rule wins (standard v1): `--color=never|always`; non-empty NO_COLOR off; FORCE_COLOR or CLICOLOR_FORCE
 * non-empty and not `0` on; FORCE_COLOR=0 or CLICOLOR=0 off; a TTY whose TERM is not `dumb` on; otherwise off. `auto` and no flag
 * apply rules 2 to 6. An unknown flag value is a usage error. `--json` is never colored: the caller does not ask.
 */
export function resolveColor(flag: string | undefined, env: ColorEnv, tool: string): boolean | Error {
  if (flag === "always") return true;
  if (flag === "never") return false;
  if (flag !== undefined && flag !== "auto") return new Error(`usage: ${tool} <command> [--color=auto|always|never]`);
  if (env.NO_COLOR) return false;
  if ((env.FORCE_COLOR && env.FORCE_COLOR !== "0") || (env.CLICOLOR_FORCE && env.CLICOLOR_FORCE !== "0")) return true;
  if (env.FORCE_COLOR === "0" || env.CLICOLOR === "0") return false;
  return env.isTTY && env.TERM !== "dumb";
}
/** ASCII markers when `--ascii` is given or the locale (`LC_ALL`, then `LC_CTYPE`, then `LANG`) is not UTF-8. */
export function asciiMarkers(env: Readonly<Record<string, string | undefined>> = process.env, flag = false): boolean {
  return flag || !/utf-?8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || "");
}

/** Remove terminal sequences and normalize line endings. Single-line mode replaces remaining controls with spaces. */
export function terminalText(value: unknown, options: { singleLine?: boolean } = {}): string {
  const text = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\|$)/g, "")
    .replace(/\x1b[P_X^][\s\S]*?(?:\x1b\\|$)/g, "")
    .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*(?:[@-~]|(?=\n|$))/g, "")
    .replace(/\x1b[^\n]?/g, "");
  return options.singleLine
    ? text.replace(/[\x00-\x1f\x7f-\x9f]/g, " ")
    : text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}

export interface Span { text: string; role?: Role }
export function paint(spans: readonly Span[], color: boolean): string {
  return spans.map(span => { const text = terminalText(span.text); const sgr = span.role && Object.hasOwn(ROLE_SGR, span.role) ? ROLE_SGR[span.role] : undefined; return color && sgr && text ? sgr + text + SGR_RESET : text; }).join("");
}
export class Report {
  private readonly out: Span[][] = [];
  /** `columns` undefined means no wrap width: standard v1 wraps on a pipe only when COLUMNS is set. */
  constructor(readonly columns: number | undefined = undefined, readonly ascii = false) {}
  /** The text as lines at most `room` cells wide, or as one line per source line when there is no wrap width. */
  private fit(text: string, room: number): string[] {
    return this.columns === undefined ? terminalText(text).split("\n").map(line => line.replace(/\t/g, " ")) : wrap(text, Math.max(10, room), 0);
  }
  private push(line: Span[]) { this.out.push(line); }
  /** ` <tool> <Report>` in `header`, then one line of context in `hint` on the same line. At most one per report. */
  header(tool: string, name: string, context?: string): this {
    this.push([{ text: ` ${tool} ${name}`, role: "header" }, ...(context ? [{ text: `  ${context}`, role: "hint" as const }] : [])]);
    return this;
  }
  /** One blank line, then `▸ <Name>` (ASCII `> <Name>`) in `section`, with an optional count in `hint`. */
  section(name: string, count?: string): this {
    if (this.out.length && this.out.at(-1)!.length) this.push([]);
    this.push([{ text: `${this.ascii ? SECTION_MARKER.ascii : SECTION_MARKER.glyph} ${name}`, role: "section" }, ...(count ? [{ text: ` (${count})`, role: "hint" as const }] : [])]);
    return this;
  }
  /**
   * Key/value rows of one section: two-space indent, `Key:` padded to the widest key, two spaces, value. A key wider than 28 cells
   * puts its value on the next line at a four-space indent. An empty value is `(unset)` in `hint`.
   */
  kv(rows: readonly (readonly [string, unknown])[], indent = 2): this {
    const keys = rows.map(([key]) => cellWidth(`${terminalText(key)}:`));
    const pad = Math.max(0, ...keys.filter(width => width <= 28));
    for (const [index, [key, raw]] of rows.entries()) {
      const label = `${terminalText(key)}:`, text = terminalText(raw ?? "").trim();
      const value = (line: string): Span => text ? { text: line, role: "value" } : { text: "(unset)", role: "hint" };
      const lead = " ".repeat(indent);
      if (keys[index]! > 28) {
        this.push([{ text: `${lead}${label}`, role: "key" }]);
        for (const line of text ? this.fit(text, (this.columns ?? 0) - indent - 2) : [""]) this.push([{ text: `${lead}  ` }, value(line)]);
        continue;
      }
      const gap = " ".repeat(pad - keys[index]! + 2), room = (this.columns ?? 0) - indent - pad - 2;
      const lines = text ? this.fit(text, room) : [""];
      this.push([{ text: lead }, { text: label, role: "key" }, { text: gap }, value(lines[0]!)]);
      for (const line of lines.slice(1)) this.push([{ text: " ".repeat(indent + pad + 2) }, value(line)]);
    }
    return this;
  }
  /** `  <marker> <text>`; a nested detail line uses four spaces. The text carries the state word, so meaning survives without color. */
  bullet(name: MarkerName, text: string, nested = false): this {
    const indent = nested ? "    " : "  ", lead = indent.length + MARKER_COLUMN + 1;
    const lines = this.fit(text, (this.columns ?? 0) - lead);
    this.push([{ text: indent }, { text: markerCell(name, this.ascii), role: MARKERS[name].role }, { text: " " }, { text: lines[0]! }]);
    for (const line of lines.slice(1)) this.push([{ text: " ".repeat(lead) + line }]);
    return this;
  }
  /** Render a table. The flexible column wraps; other columns are capped at 32 cells. */
  table(head: readonly string[], rows: readonly (readonly string[])[], flexible = head.length - 1): this {
    if (!head.length) return this;
    if (flexible < 0 || flexible >= head.length) throw new RangeError(`flexible column ${flexible} must be between 0 and ${head.length - 1}`);
    const clean = rows.map(row => head.map((_, i) => terminalText(row[i] ?? "").replace(/[\n\t]/g, " ") || "-"));
    const keep = head.map((_, i) => i).filter(i => clean.some(row => row[i] !== "-"));
    if (!keep.length) return this;
    const flexAt = keep.indexOf(flexible);
    const widths = keep.map(i => {
      const natural = Math.max(cellWidth(head[i]!.toUpperCase()), ...clean.map(row => cellWidth(row[i]!)));
      return i === flexible ? natural : Math.min(32, natural);
    });
    if (this.columns !== undefined) {
      const available = Math.max(keep.length, this.columns - 2 - 2 * (keep.length - 1));
      const minimum = flexAt >= 0 ? Math.min(10, Math.max(1, available - (keep.length - 1))) : 1;
      if (flexAt >= 0) widths[flexAt] = Math.max(minimum, Math.min(widths[flexAt]!, available - widths.reduce((sum, width, i) => sum + (i === flexAt ? 0 : width), 0)));
      while (widths.reduce((sum, width) => sum + width, 0) > available) {
        const candidates = widths.map((width, i) => ({width, i})).filter(({width, i}) => width > (i === flexAt ? minimum : 1)).sort((a, b) => b.width - a.width);
        if (!candidates.length) break;
        widths[candidates[0]!.i]!--;
      }
    }
    const pad = (text: string, width: number) => text + " ".repeat(Math.max(0, width - cellWidth(text)));
    const headings = keep.map((i, n) => wrap(head[i]!.toUpperCase(), widths[n]!, 0));
    for (let line = 0; line < Math.max(...headings.map(cell => cell.length)); line++) {
      this.push([{ text: "  " }, ...headings.flatMap((cell, n) => [{ text: n === keep.length - 1 ? (cell[line] ?? "") : pad(cell[line] ?? "", widths[n]!), role: "key" as const }, ...(n < keep.length - 1 ? [{ text: "  " }] : [])])]);
    }
    for (const row of clean) {
      const cells = keep.map((i, n) => {
        const value = row[i]!, width = Math.max(1, widths[n]!);
        if (i !== flexible && value.includes("/") && cellWidth(value) > width && width > 3) {
          let left = "", right = "";
          const chars = [...value];
          while (chars.length && cellWidth(left) < Math.floor((width - 3) / 2)) left += chars.shift();
          while (chars.length && cellWidth(left + "..." + chars.at(-1) + right) <= width) right = chars.pop() + right;
          return [left + "..." + right];
        }
        return wrap(value, width, 0);
      });
      const height = Math.max(...cells.map(cell => cell.length));
      for (let line = 0; line < height; line++) {
        const spans: Span[] = [{ text: "  " }];
        for (let n = 0; n < keep.length; n++) {
          const value = cells[n]![line] ?? "";
          spans.push({ text: n === keep.length - 1 ? value : pad(value, widths[n]!), ...(value === "-" ? { role: "hint" as const } : {}) });
          if (n < keep.length - 1) spans.push({ text: "  " });
        }
        this.push(spans);
      }
    }
    return this;
  }
  /** Lines another renderer built (a table), placed as they are. A section's blank line is still added by `section()`. */
  append(lines: readonly Span[][]): this { for (const line of lines) this.push([...line]); return this; }
  /** A free line in one role, indented two cells (a pointer to more detail, a note). */
  note(text: string, role: Role = "hint"): this {
    for (const line of this.fit(text, (this.columns ?? 0) - 2)) this.push([{ text: "  " }, { text: line, role }]);
    return this;
  }
  /** `    →  <command>` in `accent`: complete and copyable, never shortened. */
  next(command: string): this {
    this.push([{ text: "    " }, { text: `${markerCell("next", this.ascii)} ${terminalText(command)}`, role: "accent" }]);
    return this;
  }
  /** The last line of a check command: `✗ 2 failed  ⚠ 3 warnings  ✓ 18 ok`, zero counts omitted, unknowns as `? 2 unknown`. */
  summary(counts: { failed?: number; warnings?: number; unknown?: number; ok?: number }): this {
    const parts: Span[] = [];
    const add = (n: number | undefined, name: MarkerName, word: string) => {
      if (!n) return;
      if (parts.length) parts.push({ text: "  " });
      parts.push({ text: `${this.ascii ? MARKERS[name].ascii : MARKERS[name].glyph} ${n} ${word}`, role: MARKERS[name].role });
    };
    add(counts.failed, "fail", "failed"); add(counts.warnings, "warn", counts.warnings === 1 ? "warning" : "warnings"); add(counts.unknown, "unknown", "unknown"); add(counts.ok, "ok", "ok");
    if (parts.length) { if (this.out.length) this.push([]); this.push(parts); }
    return this;
  }
  lines(): Span[][] { return this.out.map(line => line.map(item => ({ ...item }))); }
  /** The report as text: one painted string per line, no trailing blank line. */
  render(color: boolean): string[] { return this.out.map(line => paint(line, color)); }
}

export function wrap(value: unknown, columns: number, hang = 4): string[] {
  const lines: string[] = [];
  const half = Math.floor(columns / 2);
  const width = cellWidth;
  for (const part of terminalText(value).replace(/\t/g, " ").split("\n")) {
    const indent = /^\s*/.exec(part)![0];
    const lead = Math.min(cellWidth(indent), half);
    const pad = " ".repeat(Math.min(lead + hang, half));
    const first = lines.length;
    let start = " ".repeat(lead);
    let line = start;
    const push = () => { lines.push(line.trimEnd()); line = start = pad; };
    for (const token of part.slice(indent.length).match(/\s+|\S+/g) ?? []) {
      if (width(line + token) <= columns) { line += token; continue; }
      if (line !== start) push();
      if (/^\s/.test(token)) continue;
      for (const char of token) {
        if (line !== start && width(line + char) > columns) push();
        line += char;
      }
    }
    if (line !== start || lines.length === first) lines.push(line.trimEnd());
  }
  return lines;
}

export const EXIT = Object.freeze({ ok: 0, fail: 1, usage: 2, tempfail: 75 } as const);
export function errorLine(tool: string, what: string, why: string, options: { next?: string; tty: boolean; ascii?: boolean }): string[] {
  const message = `${terminalText(tool)}: ${terminalText(what)}${why ? `: ${terminalText(why)}` : ""}`;
  const first = options.tty ? `${options.ascii ? MARKERS.fail.ascii : MARKERS.fail.glyph} ${message}` : message;
  return options.next ? [first, `  ${options.ascii ? MARKERS.next.ascii : MARKERS.next.glyph} ${terminalText(options.next)}`] : [first];
}
