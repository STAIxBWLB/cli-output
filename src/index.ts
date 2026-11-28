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
/** Resolve wrapping width for one stream; pipes use only a valid COLUMNS value. */
export function streamWidth(isTTY: boolean, columns?: number, env: Readonly<Record<string, string | undefined>> = process.env): number | undefined {
  if (isTTY && Number.isInteger(columns) && columns! > 0) return columns;
  const value = env.COLUMNS;
  if (!value || !/^[1-9][0-9]*$/.test(value)) return undefined;
  const width = Number(value);
  return Number.isSafeInteger(width) ? width : undefined;
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

export interface Span { text: string; role?: Role; style?: string }
export interface ReportOptions {
  sanitize?: (text: string) => string;
  styles?: Readonly<Record<string, string>>;
  wrapNext?: boolean;
  sanitizeFirst?: boolean;
  sanitizeChunks?: boolean;
  keepTokensWhole?: boolean;
  split?: "grapheme" | "codepoint";
}
export type TableCell = string | Span;
export interface TableOptions {
  indent?: number;
  dropEmptyColumns?: boolean;
  headerCase?: "upper" | "preserve";
  emptyCell?: "dash" | "blank";
  widths?: readonly number[];
  columnCaps?: readonly (number | "third" | null)[];
  clip?: boolean;
  headingStyle?: string;
}
export interface KvOptions { colon?: boolean; omitEmpty?: boolean }
/** Standard semantic roles take precedence over optional consumer styles. */
export function paint(spans: readonly Span[], color: boolean, styles: Readonly<Record<string, string>> = {}): string {
  return spans.map(span => {
    const text = terminalText(span.text);
    const role = span.role && Object.hasOwn(ROLE_SGR, span.role) ? ROLE_SGR[span.role] : undefined;
    const custom = span.style && Object.hasOwn(styles, span.style) ? styles[span.style] : undefined;
    if (custom && !/^\x1b\[[0-9;]+m$/.test(custom)) throw new Error(`invalid SGR for style ${span.style}`);
    const sgr = role !== undefined ? role : custom;
    return color && sgr && text ? sgr + text + SGR_RESET : text;
  }).join("");
}
/** Split only at unquoted, unescaped horizontal whitespace; shell comments remain whole. */
function commandWords(command: string): string[] {
  const words: string[] = []; let word = ""; let quote = ""; let escaped = false;
  for (let index = 0; index < command.length; index++) {
    const char = command[index]!;
    if (escaped) { word += char; escaped = false; continue; }
    if (char === "\\" && quote !== "'") { word += char; escaped = true; continue; }
    if (quote) { word += char; if (char === quote) quote = ""; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; word += char; continue; }
    if (char === "#" && !word) { word = command.slice(index); break; }
    if (char === " " || char === "\t") { if (word) { words.push(word); word = ""; } continue; }
    word += char;
  }
  if (word) words.push(word);
  return words;
}
/** Keep shell tokens whole and mark wrapped next steps with continuations. */
function nextStepSpans(text: string, marker: string, indent: number, columns?: number): Span[][] {
  const prefix = " ".repeat(indent);
  if (columns === undefined || text.includes("\n") || cellWidth(prefix + marker + text) <= columns) {
    return [[{ text: prefix }, { text: marker + text, role: "accent" }]];
  }
  const words = commandWords(text), room = Math.max(1, columns - indent - cellWidth(marker));
  if (!words.length) return [[{ text: prefix }, { text: marker + text, role: "accent" }]];
  let line = ""; const lines: string[] = [];
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && cellWidth(candidate) > room - 2) { lines.push(line + " \\"); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines.map((part, index) => [{ text: index ? " ".repeat(indent + cellWidth(marker)) : prefix }, { text: (index ? "" : marker) + part, role: "accent" }]);
}
export class Report {
  private readonly out: Span[][] = [];
  /** `columns` undefined means no wrap width: standard v1 wraps on a pipe only when COLUMNS is set. */
  constructor(readonly columns: number | undefined = undefined, readonly ascii = false, readonly options: ReportOptions = {}) {}
  private clean(value: unknown): string {
    const raw = String(value ?? "");
    if (this.options.sanitizeFirst && this.options.sanitize) return terminalText(this.options.sanitize(raw));
    const text = terminalText(raw);
    return this.options.sanitize ? terminalText(this.options.sanitize(text)) : text;
  }
  /** A sanitizer that changes a whole line cannot reliably preserve its original span boundaries. */
  private cleanLine(line: readonly Span[]): Span[] {
    if (!this.options.sanitize) return line.map(item => ({ ...item }));
    const clean = line.map(item => ({ ...item, text: this.options.sanitizeFirst ? item.text : terminalText(item.text) }));
    const text = clean.map(item => item.text).join("");
    const result = this.clean(text);
    return result === text ? clean.map(item => ({ ...item, text: terminalText(item.text) })) : [{ text: result }];
  }
  private wrapText(text: string, columns: number | undefined, hang = 0, keepTokensWhole = this.options.keepTokensWhole): string[] {
    const chunk = this.options.sanitizeChunks && this.options.sanitize
      ? (value: string) => this.clean(value + " ").slice(0, -1)
      : undefined;
    return wrap(text, columns, hang, chunk, keepTokensWhole, this.options.split);
  }
  /** The text as lines at most `room` cells wide, or as one line per source line when there is no wrap width. */
  private fit(text: string, room: number): string[] {
    return this.columns === undefined ? this.clean(text).split("\n").map(line => line.replace(/\t/g, " ")) : this.wrapText(this.clean(text), Math.max(10, room), 0);
  }
  private push(line: Span[]) { this.out.push(this.cleanLine(line)); }
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
  kv(rows: readonly (readonly [string, unknown])[], indent = 2, options: KvOptions = {}): this {
    if (options.omitEmpty) rows = rows.filter(([, value]) => this.clean(value ?? "").trim() !== "");
    const suffix = options.colon === false ? "" : ":";
    const keys = rows.map(([key]) => cellWidth(`${this.clean(key)}${suffix}`));
    const pad = Math.max(0, ...keys.filter(width => width <= 28));
    for (const [index, [key, raw]] of rows.entries()) {
      const label = `${this.clean(key)}${suffix}`, text = this.clean(raw ?? "").trim();
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
  table(head: readonly string[], rows: readonly (readonly TableCell[])[], flexible = head.length - 1, options: TableOptions = {}): this {
    if (!head.length) return this;
    if (flexible < 0 || flexible >= head.length) throw new RangeError(`flexible column ${flexible} must be between 0 and ${head.length - 1}`);
    const indent = options.indent ?? 2;
    if (!Number.isInteger(indent) || indent < 0) throw new RangeError("table indent must be a nonnegative integer");
    if (options.widths && (options.widths.length !== head.length || options.widths.some(width => !Number.isSafeInteger(width) || width < 1))) {
      throw new RangeError("table widths must contain one positive integer per column");
    }
    if (options.columnCaps && (options.columnCaps.length !== head.length || options.columnCaps.some(cap => cap !== null && cap !== "third" && (!Number.isSafeInteger(cap) || cap < 1)))) {
      throw new RangeError("table columnCaps must contain one positive integer, third, or null per column");
    }
    const heading = (i: number) => options.headerCase === "preserve" ? this.clean(head[i]!) : this.clean(head[i]!).toUpperCase();
    const clean = rows.map(row => head.map((_, i) => {
      const cell = row[i] ?? "";
      const value = this.clean(typeof cell === "string" ? cell : cell.text).replace(/[\n\t]/g, " ");
      const text = value || (options.emptyCell === "blank" ? "" : "-");
      const role = typeof cell === "string" ? undefined : cell.role;
      const style = typeof cell === "string" ? undefined : cell.style;
      return { text, role: role ?? (text === "-" && !style ? "hint" as const : undefined), style };
    }));
    const keep = head.map((_, i) => i).filter(i => options.dropEmptyColumns === false || clean.some(row => row[i]!.text !== "-" && row[i]!.text !== ""));
    if (!keep.length) return this;
    const flexAt = keep.indexOf(flexible);
    const widths = keep.map(i => {
      if (options.widths) return options.widths[i]!;
      const natural = Math.max(cellWidth(heading(i)), ...clean.map(row => cellWidth(row[i]!.text)));
      const cap = options.columnCaps?.[i];
      const limit = cap === "third" ? Math.max(24, Math.floor((this.columns ?? 96) / 3)) : cap ?? (i === flexible ? natural : 32);
      return Math.min(limit, natural);
    });
    if (this.columns !== undefined && !options.widths) {
      const available = Math.max(keep.length, this.columns - indent - 2 * (keep.length - 1));
      const minimum = flexAt >= 0 ? Math.min(10, Math.max(1, available - (keep.length - 1))) : 1;
      if (flexAt >= 0) widths[flexAt] = Math.max(minimum, Math.min(widths[flexAt]!, available - widths.reduce((sum, width, i) => sum + (i === flexAt ? 0 : width), 0)));
      while (widths.reduce((sum, width) => sum + width, 0) > available) {
        const candidates = widths.map((width, i) => ({width, i})).filter(({width, i}) => width > (i === flexAt ? minimum : 1)).sort((a, b) => b.width - a.width);
        if (!candidates.length) break;
        widths[candidates[0]!.i]!--;
      }
    }
    const pad = (text: string, width: number) => text + " ".repeat(Math.max(0, width - cellWidth(text)));
    const headings = keep.map((i, n) => this.wrapText(heading(i), widths[n]!, 0, false));
    for (let line = 0; line < Math.max(...headings.map(cell => cell.length)); line++) {
      this.push([{ text: " ".repeat(indent) }, ...headings.flatMap((cell, n) => [{ text: n === keep.length - 1 ? (cell[line] ?? "") : pad(cell[line] ?? "", widths[n]!), ...(options.headingStyle ? { style: options.headingStyle } : { role: "key" as const }) }, ...(n < keep.length - 1 ? [{ text: "  " }] : [])])]);
    }
    for (const row of clean) {
      const cells = keep.map((i, n) => {
        const value = row[i]!.text, width = Math.max(1, widths[n]!);
        if (options.clip && i !== flexible && cellWidth(value) > width) {
          const marker = ".".repeat(Math.min(3, width));
          let prefix = "";
          for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)) {
            if (cellWidth(this.clean(prefix + segment + marker)) > width) break;
            prefix += segment;
          }
          return [this.clean(prefix + marker)];
        }
        if (i !== flexible && value.includes("/") && cellWidth(value) > width && width > 3) {
          let left = "", right = "";
          const chars = [...value];
          while (chars.length && cellWidth(left) < Math.floor((width - 3) / 2)) left += chars.shift();
          while (chars.length && cellWidth(left + "..." + chars.at(-1) + right) <= width) right = chars.pop() + right;
          return [left + "..." + right];
        }
        return this.wrapText(value, width, 0, i === flexible && this.options.keepTokensWhole);
      });
      const height = Math.max(...cells.map(cell => cell.length));
      for (let line = 0; line < height; line++) {
        const spans: Span[] = [{ text: " ".repeat(indent) }];
        for (let n = 0; n < keep.length; n++) {
          const value = cells[n]![line] ?? "";
          spans.push({ text: n === keep.length - 1 ? value : pad(value, widths[n]!), ...(value && row[keep[n]!]!.role ? { role: row[keep[n]!]!.role } : {}), ...(value && row[keep[n]!]!.style ? { style: row[keep[n]!]!.style } : {}) });
          if (n < keep.length - 1) spans.push({ text: "  " });
        }
        this.push(spans);
      }
    }
    return this;
  }
  /** Lines another renderer built (a table), placed as they are. A section's blank line is still added by `section()`. */
  append(lines: readonly Span[][]): this { for (const line of lines) this.push([...line]); return this; }
  /** Append unindented wrapped text; standalone callers can use lineSpans to stream it. */
  line(text: string): this {
    for (const line of this.wrapText(this.clean(text), this.columns)) this.push([{ text: line }]);
    return this;
  }
  /** A free line in one role, indented two cells (a pointer to more detail, a note). */
  note(text: string, role: Role = "hint"): this {
    for (const line of this.fit(text, (this.columns ?? 0) - 2)) this.push([{ text: "  " }, { text: line, role }]);
    return this;
  }
  /** `    →  <command>` in `accent`: complete and copyable, never shortened. */
  next(command: string): this {
    const text = this.clean(command), marker = `${markerCell("next", this.ascii)} `;
    for (const line of nextStepSpans(text, marker, 4, this.options.wrapNext === false ? undefined : this.columns)) this.push(line);
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
  render(color: boolean): string[] { return this.out.map(line => paint(this.cleanLine(line), color, this.options.styles)); }
}

export function wrap(value: unknown, columns?: number, hang = 4, sanitizeChunk?: (text: string) => string, keepTokensWhole = false, split: NonNullable<ReportOptions["split"]> = "grapheme"): string[] {
  if (columns === undefined) return terminalText(value).replace(/\t/g, " ").split("\n");
  if (split === "codepoint") {
    if (columns < 0) throw new RangeError("wrap columns must be non-negative in codepoint mode");
  } else if (!Number.isFinite(columns) || columns < 1) {
    throw new RangeError("wrap columns must be positive");
  }
  const lines: string[] = [];
  const half = Math.floor(columns / 2);
  const chunk = (text: string) => terminalText(sanitizeChunk ? sanitizeChunk(text) : text);
  const width = (text: string) => cellWidth(chunk(text));
  for (const part of terminalText(value).replace(/\t/g, " ").split("\n")) {
    const indent = /^\s*/.exec(part)![0];
    const lead = Math.min(cellWidth(indent), half);
    const pad = " ".repeat(Math.min(lead + hang, half));
    const first = lines.length;
    let start = " ".repeat(lead);
    let line = start;
    const push = () => { lines.push(chunk(line.trimEnd())); line = start = pad; };
    for (const token of part.slice(indent.length).match(/\s+|\S+/g) ?? []) {
      if (width(line + token) <= columns) { line += token; continue; }
      if (line !== start) push();
      if (/^\s/.test(token)) continue;
      if (keepTokensWhole) { line += token; continue; }
      const segments = split === "codepoint" ? token : new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(token);
      for (const segment of segments) {
        const char = typeof segment === "string" ? segment : segment.segment;
        if (line !== start && width(line + char) > columns) push();
        line += char;
      }
    }
    if (line !== start || lines.length === first) lines.push(chunk(line.trimEnd()));
  }
  return lines;
}

/** Wrap semantic spans without losing their roles or styles at line breaks. */
export function wrapSpans(spans: readonly Span[], columns?: number, hang = 4): Span[][] {
  const raw = spans.map(span => span.text).join("");
  const whole = terminalText(raw);
  let clean = spans.map(span => ({ ...span, text: terminalText(span.text) }));
  // A control sequence crossing span boundaries must be removed as one unit.
  if (clean.map(span => span.text).join("") !== whole) clean = [{ text: whole }];
  if (columns === undefined) return [clean];
  clean = clean.map(span => ({ ...span, text: span.text.replace(/\t/g, " ") }));
  const text = clean.map(span => span.text).join("");
  const lines = wrap(text, columns, hang);
  let cursor = 0;
  return lines.map(line => {
    const content = line.trimStart();
    if (!content) return [{ text: line }];
    const start = text.indexOf(content, cursor);
    if (start < 0) throw new Error("wrapped span text could not be mapped to its source");
    const end = start + content.length; cursor = end;
    const result: Span[] = [];
    const indent = line.slice(0, line.length - content.length);
    if (indent) result.push({ text: indent });
    let offset = 0;
    for (const span of clean) {
      const next = offset + span.text.length;
      if (next > start && offset < end) result.push({ ...span, text: span.text.slice(Math.max(0, start - offset), Math.min(span.text.length, end - offset)) });
      offset = next;
      if (offset >= end) break;
    }
    return result;
  });
}

/** Unindented plain-text lines for streaming or direct painting. */
export function lineSpans(text: string, columns?: number): Span[][] {
  return wrap(text, columns, 0).map(line => [{ text: line }]);
}

export const EXIT = Object.freeze({ ok: 0, fail: 1, usage: 2, tempfail: 75 } as const);
export interface ErrorOptions { next?: string; tty: boolean; ascii?: boolean }
/** Error and next-step spans for a single stream; use paint with that stream's color decision. */
export function errorSpans(tool: string, what: string, why: string, options: ErrorOptions, columns?: number): Span[][] {
  const message = `${terminalText(tool)}: ${terminalText(what)}${why ? `: ${terminalText(why)}` : ""}`;
  const first: Span[] = options.tty
    ? [{ text: `${options.ascii ? MARKERS.fail.ascii : MARKERS.fail.glyph} `, role: MARKERS.fail.role }, { text: message }]
    : [{ text: message }];
  const lines = columns === undefined ? [first] : wrapSpans(first, columns, 0);
  if (options.next) lines.push(...nextStepSpans(terminalText(options.next), `${options.ascii ? MARKERS.next.ascii : MARKERS.next.glyph} `, 2, columns));
  return lines;
}
/** Plain-string compatibility form. */
export function errorLine(tool: string, what: string, why: string, options: ErrorOptions, columns?: number): string[] {
  return errorSpans(tool, what, why, options, columns).map(line => paint(line, false));
}
