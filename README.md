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

Table cells may be strings or `{ text, role }` spans. `table` accepts `{ indent, dropEmptyColumns }` as its fourth argument; `kv` accepts `{ colon, omitEmpty }` as its third argument. Their defaults preserve the standard layout. `wrap` accepts an omitted width for unbounded lines and keeps grapheme clusters intact. `streamWidth` resolves a stream width from its TTY columns or `COLUMNS`.

`lineSpans(text, columns)` returns unindented wrapped lines ready to paint or write individually; `Report.line(text)` appends the same lines to a buffered report. `errorSpans` returns role-tagged diagnostics for painting with the destination stream's own color decision. The existing `errorLine` returns plain strings.

`Report` accepts an optional third argument `{ sanitize, styles }`. `sanitize` is an idempotent text-to-text function applied before wrapping, to assembled lines at construction, and again before rendering; terminal controls are still removed. If sanitization changes an assembled line, that line is rendered without span styles because its original span boundaries may no longer be valid. Consumer `styles` map names to ANSI SGR sequences, and `Span.style` selects one; standard `role` takes precedence.

## Vendoring tokens and fixtures

For a non-Bun implementation, copy `tokens/v1.json` and `fixtures/v1/` from an exact release tag, preserving paths. Record the tag alongside the copies. Verify each vendored file against that tag with `git show <tag>:<path>` and a SHA-256 comparison, and check the complete file list as well as the checksums. Run all fixtures in the consumer's tests.

## Versions

The standard version is v1. Breaking API or token changes increment the package major version, new roles, markers or functions increment the minor, and fixes increment the patch. Publishing uses npm trusted publishing; the publisher must be registered on npm before a release tag is pushed.
