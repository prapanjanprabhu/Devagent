import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default {
  output: "standalone", // small self-contained build for Docker
  outputFileTracingRoot: here,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] }];
  },
};
