# @staix/cli-output

CLI output standard v1 for Bun 1.4.4 or later. The package has no runtime dependencies. See [the standard](docs/standard-v1.md) for the output contract.

```ts
import { Report, resolveColor, streamEnv } from "@staix/cli-output";
const color = resolveColor("auto", streamEnv(process.stdout.isTTY), "mytool");
if (color instanceof Error) throw color;
console.log(new Report(80).section("Checks").bullet("ok", "ready").render(color).join("\n"));
```

`Report` is experimental until its API settles. `resolveColor` returns an Error for an invalid flag; decide stdout and stderr separately.

`terminalText(value)` removes terminal sequences and normalizes CRLF and CR to LF, preserving tabs and newlines. Pass `{ singleLine: true }` to replace remaining control characters with spaces for single-line fields.

## Vendoring tokens and fixtures

For a non-Bun implementation, copy `tokens/v1.json` and `fixtures/v1/` from an exact release tag, preserving paths. Record the tag alongside the copies. Verify each vendored file against that tag with `git show <tag>:<path>` and a SHA-256 comparison, and check the complete file list as well as the checksums. Run all fixtures in the consumer's tests.

## Versions

The standard version is v1. Breaking API or token changes increment the package major version, new roles, markers or functions increment the minor, and fixes increment the patch. Publishing uses npm trusted publishing; the publisher must be registered on npm before a release tag is pushed.
