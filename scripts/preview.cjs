// Serve the exact production build locally, including client-side routes.
// No build, bake, or deployment is performed by this command.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const root = path.resolve(__dirname, "../build");
const port = Number(process.env.PORT || 3001);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("No production build. Run npm run build first.");
  process.exit(1);
}
http
  .createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
    } catch {
      response.writeHead(400).end();
      return;
    }
    let file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) {
      response.writeHead(403).end();
      return;
    }
    if (!path.extname(file)) file = path.join(root, "index.html");
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      const extension = path.extname(file);
      response.setHeader(
        "Content-Type",
        mime[extension] || "application/octet-stream",
      );
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Vary", "Accept-Encoding");
      if (
        /\bgzip\b/.test(request.headers["accept-encoding"] || "") &&
        [".html", ".js", ".css", ".json"].includes(extension)
      ) {
        data = zlib.gzipSync(data);
        response.setHeader("Content-Encoding", "gzip");
      }
      response.setHeader("Content-Length", data.length);
      response.writeHead(200).end(request.method === "HEAD" ? undefined : data);
    });
  })
  .on("error", (error) => {
    console.error(
      `Preview could not start: ${error.message}. Set PORT to use another port.`,
    );
    process.exitCode = 1;
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Production preview: http://127.0.0.1:${port} (local only)`),
  );
