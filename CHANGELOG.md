# Changelog

Notable changes to `@staix/cli-output`. During 0.x a breaking API or token change is a minor release and anything else is a patch (#5). Each release is published from its `v<version>` tag through npm trusted publishing.

## Unreleased

- Add opt-in code-point wrapping to `wrap` and `ReportOptions`. Direct `wrap` calls in this mode accept zero-width layouts. (issue #36)

## 0.1.3 - 2026-11-23

- **Added**
  - `Report` option `sanitizeChunks: true` applies the consumer sanitizer to each wrapped chunk and counts the text it adds toward the width. `wrap` takes the matching optional chunk sanitizer. (#32, issue #29)
  - `table` options `columnCaps` (a positive width, `"third"` or null per column), `clip: true`, which shortens non-flexible cells with `...`, and `headingStyle`, which gives headings a consumer style instead of the `key` role. (#33, issue #30)
  - `Report` option `keepTokensWhole: true` keeps a long URL, path or command whole on its own line in prose and in a table's flexible column. Non-flexible cells keep their widths. `wrap` takes the matching optional flag. (#34, issue #31)
  - New fixtures:
    - `fixtures/v1/report/quote-chunks-12.json` and `quote-chunks-16.json`;
    - `fixtures/v1/report/table-clipping.json`;
    - `fixtures/v1/report/whole-url-table.json` and `whole-path-bullet.json`.
- **For consumers running the fixtures**
  - Support the `note` operation.
  - Pass the new `reportOptions` (`sanitizeChunks`, `keepTokensWhole`) and table options (`columnCaps`, `clip`, `headingStyle`).

## 0.1.2 - 2026-11-23

- **Added**
  - `Report` options `wrapNext: false`, which keeps a long next-step command on one line, and `sanitizeFirst: true`, which runs the consumer sanitizer before terminal-control normalization. `terminalText` still runs last. (#23, issue #20)
  - `wrapSpans(spans, columns?, hang?)` wraps semantic spans and keeps their roles and styles across line breaks. (#24, issue #22)
  - `errorSpans` and `errorLine` take an optional width. The diagnostic wraps and keeps the fail marker role, and a long next step wraps with shell continuations. (#25, issue #19)
  - `table` options `headerCase: "preserve"`, `emptyCell: "blank"` and per-column `widths`. (#26, issue #21)
  - New fixtures:
    - `fixtures/v1/span-wrap.json`;
    - `fixtures/v1/report/compat.json`;
    - `fixtures/v1/report/table-options.json`;
    - width cases in `fixtures/v1/error-line.json`.
- **Changed**
  - `docs/standard-v1.md`: the next-step rule names the legacy unwrapped option, and says that output exceeding the width under it does not meet the width rule. (#23)
- **For consumers running the fixtures**
  - Pass `columns` to the error cases.
  - Pass `reportOptions` and the `drop-cr` sanitizer to the report fixtures.
  - Run `span-wrap.json`.

## 0.1.1 - 2026-11-23

- **Added**
  - Table cells may be `{ text, role }` spans. `table` takes `{ indent, dropEmptyColumns }` and `kv` takes `{ colon, omitEmpty }`; `streamWidth` resolves a stream width. (#12, issue #7)
  - `Report.line`, `lineSpans` and `errorSpans` for unindented wrapped lines and role-tagged error and next-step spans. (#14, issue #6)
  - `Span.style` and `Report` options `{ sanitize, styles }`. The consumer sanitizer runs at construction, on assembled lines and before rendering, and standard roles take precedence over consumer styles. (#16, issue #10)
  - `engines.bun >= 1.4.2`; CI runs the tests on Bun 1.4.2 and 1.4.4. (#13, issue #9)
- **Changed**
  - `wrap` accepts an omitted width for unbounded lines and keeps grapheme clusters intact. (#12)
  - With a width set, `Report.next` wraps a long command at unquoted whitespace with shell continuations and never splits a token. `docs/standard-v1.md` states the rule. (#17, issue #15)
- **Fixed**
  - `terminalText` removes C1 CSI sequences as a unit and normalizes CRLF and CR to LF. (#11, issue #8)
- **For consumers running the fixtures**
  - Support the `line` and `append` operations.
  - Pass the kv and table options.
  - Pass the `sanitizer` and `styles` inputs; the README defines `quote-headers`.
  - Run the new `text.json` and `wrap.json`.

## 0.1.0 - 2026-11-22

- First release:
  - the CLI output standard v1 text (`docs/standard-v1.md`);
  - the design tokens (`tokens/v1.json`);
  - the conformance fixtures (`fixtures/v1/`);
  - the Bun/TypeScript implementation: roles, markers, color precedence, `Report`, `errorLine` and `EXIT`. (#2)
- `1.0.0` was published too early and unpublished, and npm will never accept that version again. The first stable release is `1.0.1` or later. (#5)
