export default { async headers() { return [{ source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] }]; } };
