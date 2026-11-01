/** @type {import('next').NextConfig} */
// Firebase Auth in the browser needs its handler iframe (frame-src) and its
// REST endpoints (connect-src); without them sign-in fails with
// auth/internal-error. Everything else stays same-origin only.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  "frame-src 'self' https://*.firebaseapp.com",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      // Serve the Firebase Auth handler from the portal's own origin (the
      // config route reports this host as authDomain). Browsers that block
      // third-party storage otherwise lose the sign-in result on return and
      // Firebase reports auth/internal-error.
      {
        source: "/__/auth/:path*",
        destination: "https://project-8b9ab843-d0d6-4ea4-a11.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        // The auth handler is Firebase's own page; our portal CSP would
        // block its scripts, so it gets a permissive policy instead.
        source: "/__/auth/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};
export default nextConfig;
