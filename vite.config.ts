// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Dev proxy plugin to avoid browser CORS when mobile devices (e.g. 10.140.178.17) fetch Firebase Storage documents
const proxyDocumentPlugin = () => ({
  name: "proxy-document-plugin",
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && req.url.startsWith("/api/proxy-document")) {
        try {
          const parsed = new URL(req.url, "http://localhost");
          const targetUrl = parsed.searchParams.get("url");
          if (!targetUrl) {
            res.statusCode = 400;
            res.end("Missing url parameter");
            return;
          }
          const upstream = await fetch(targetUrl);
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end(`Upstream fetch failed: ${upstream.status}`);
            return;
          }
          res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/pdf");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          const arrayBuffer = await upstream.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(err.message || "Proxy error");
        }
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  vite: {
    plugins: [proxyDocumentPlugin()],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
