const result = Bun.spawnSync(["npm", "pack", "--dry-run", "--json"], { stdout: "pipe", stderr: "pipe" });
if (result.exitCode !== 0) throw new Error(result.stderr.toString());
const pack = JSON.parse(result.stdout.toString()) as unknown;
const first = pack && typeof pack === "object" ? Object.values(pack)[0] as { files?: { path: string }[] } | undefined : undefined;
if (!first || !Array.isArray(first.files)) throw new Error("npm pack returned no file list");
const allowed = /^(?:LICENSE|README\.md|package\.json|src\/index\.ts|docs\/standard-v1\.md|tokens\/v1\.json|fixtures\/v1\/(?:color\.json|markers\.json|error-line\.json|text\.json|wrap\.json|report\/[^/]+\.json))$/;
const files = first.files.map(file => file.path);
if (files.some(file => !allowed.test(file)) || !["src/index.ts", "tokens/v1.json", "fixtures/v1/color.json", "fixtures/v1/markers.json", "fixtures/v1/error-line.json", "fixtures/v1/text.json", "fixtures/v1/wrap.json", "docs/standard-v1.md"].every(file => files.includes(file)) || !files.some(file => file.startsWith("fixtures/v1/report/"))) throw new Error(`Unexpected tarball contents: ${files.join(", ")}`);
