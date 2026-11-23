# @staix/cli-output

CLI output standard v1 for Bun 1.4.2 or later. The package has no runtime dependencies. CI runs the test suite on Bun 1.4.2 and the full checks on Bun 1.4.4. See [the standard](docs/standard-v1.md) for the output contract.

```ts
import { Report, resolveColor, streamEnv } from "@staix/cli-output";
const color = resolveColor("auto", streamEnv(process.stdout.isTTY), "mytool");
if (color instanceof Error) throw color;
console.log(new Report(80).section("Checks").bullet("ok", "ready").render(color).join("\n"));
```

`Report` is experimental until its API settles. `resolveColor` returns an Error for an invalid flag; decide stdout and stderr separately.

`terminalText(value)` removes terminal sequences and normalizes CRLF and CR to LF, preserving tabs and newlines. Pass `{ singleLine: true }` to replace remaining control characters with spaces for single-line fields.

Table cells may be strings or `{ text, role }` spans. `table` accepts `{ indent, dropEmptyColumns, headerCase, emptyCell, widths, columnCaps, clip, headingStyle }` as its fourth argument; `kv` accepts `{ colon, omitEmpty }` as its third argument. Their defaults preserve the standard layout. Set `headerCase: "preserve"` and `emptyCell: "blank"` for legacy output; `widths` supplies one positive cell width for each original column and remains fixed even if the table exceeds the report width. `columnCaps` accepts one positive width, `"third"` (the greater of 24 cells and one third of the report width), or null per column; `clip: true` shortens non-flexible cells with `...`. `headingStyle` selects a consumer style for headings. `wrap` accepts an omitted width for unbounded lines and keeps grapheme clusters intact. `streamWidth` resolves a stream width from its TTY columns or `COLUMNS`.

`lineSpans(text, columns)` returns unindented wrapped lines ready to paint or write individually; `Report.line(text)` appends the same lines to a buffered report. `errorSpans` returns role-tagged diagnostics for painting with the destination stream's own color decision. The existing `errorLine` returns plain strings. Both helpers accept an optional final width argument that wraps the diagnostic and uses shell continuations for long next-step commands without shortening them.

`Report` accepts an optional third argument `{ sanitize, styles, sanitizeFirst, wrapNext }`. Set `sanitizeFirst: true` to apply the sanitizer before terminal control normalization; terminalText still runs afterward. Set `wrapNext: false` to retain a long next command on one line for legacy consumers; this opt-out may exceed the standard width. `sanitize` is an idempotent text-to-text function applied before wrapping, to assembled lines at construction, and again before rendering; terminal controls are still removed. If sanitization changes an assembled line, that line is rendered without span styles because its original span boundaries may no longer be valid. Consumer `styles` map names to ANSI SGR sequences, and `Span.style` selects one; standard `role` takes precedence.

The `quote-headers` sanitizer named by the consumer report fixture prefixes `> ` to each line whose first non-whitespace text starts with `[agent-hub` (case-insensitive, followed by a word boundary) or `--- from ` (case-insensitive).

`wrapSpans(spans, columns?, hang?)` wraps sanitized semantic spans while retaining their roles and styles. Without a width it returns one line containing the sanitized spans. A terminal escape split across spans is removed as a unit; that exceptional line loses its style boundaries.

Set `keepTokensWhole: true` to place long tokens on their own line without splitting them; a token wider than the available width may exceed it. In tables, this option applies only to the flexible column; non-flexible cells remain within their widths, with paths shortened in the middle when necessary. Set `sanitizeChunks: true` to apply the report sanitizer to candidate text chunks while wrapping and measure its added text before layout. The sanitizer must be idempotent and preserve a trailing space; it is still applied to constructed and rendered lines.

The `drop-cr` sanitizer in `fixtures/v1/report/compat.json` removes every carriage return. The fixture’s `reportOptions` object supplies the optional third argument to `Report`.

## Vendoring tokens and fixtures

For a non-Bun implementation, copy `tokens/v1.json` and `fixtures/v1/` from an exact release tag, preserving paths. Record the tag alongside the copies. Verify each vendored file against that tag with `git show <tag>:<path>` and a SHA-256 comparison, and check the complete file list as well as the checksums. Run all fixtures in the consumer's tests.

## Versions

The standard version is v1. Breaking API or token changes increment the package major version, new roles, markers or functions increment the minor, and fixes increment the patch. Publishing uses npm trusted publishing; the publisher must be registered on npm before a release tag is pushed.
