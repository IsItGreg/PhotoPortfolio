const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const root = path.resolve(__dirname, "..");
const build = path.join(root, "build");
const manifest = require("../src/ThreeDim/generated/scene-assets.json");
for (const url of [
  manifest.model,
  manifest.woodColor,
  manifest.woodNormal,
  ...manifest.labels.map((label) => label.url),
]) {
  const [file, version] = url.split("?v=");
  const bytes = fs.readFileSync(path.join(build, file));
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16),
    version,
    `Stale baked asset: ${file}`,
  );
}
const jsDir = path.join(build, "static/js");
const jsFiles = fs.readdirSync(jsDir).filter((file) => file.endsWith(".js"));
assert(
  !fs.readdirSync(jsDir).some((file) => file.endsWith(".map")),
  "Production source maps must be disabled",
);
const chunks = jsFiles.map((file) => {
  const bytes = fs.readFileSync(path.join(jsDir, file));
  const code = bytes.toString();
  assert(
    !code.includes("Box studio · development only"),
    "Development inspector leaked into production",
  );
  assert(
    !code.includes("troika-text"),
    "Runtime text engine leaked into production",
  );
  return { file, bytes: bytes.length, gzip: zlib.gzipSync(bytes).length };
});
const media = fs.readdirSync(path.join(build, "static/media"));
assert(
  !media.some(
    (file) => file.includes("cardboard_mailer_v4") || file.includes("Wood051"),
  ),
  "Authoring assets leaked into production",
);
// Sources stay in the repo/public for compatibility; remove only these obsolete
// source copies from the disposable build output, never from the working tree.
for (const file of [
  "LOSTLATE.ttf",
  "Wood051_1K-JPG_Color.jpg",
  "Wood051_1K-JPG_NormalDX.jpg",
]) {
  fs.rmSync(path.join(build, file), { force: true });
}
console.log(
  "Production scene verified: current baked assets; no authoring model, inspector or live text engine.",
);
console.log(
  "Largest JS chunks:",
  chunks.sort((a, b) => b.bytes - a.bytes).slice(0, 3),
);
