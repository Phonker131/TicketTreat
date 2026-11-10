/* TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
 * Security headers, API and private-page caching rules. Regressions here can
 * expose authenticated data or weaken the browser's security boundary.
 * Obtain @Phonker131 review and test before changing. See
 * docs/CRITICAL_CODE_AREAS.md. This comment is not an access restriction.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {source: "/:path*", headers: [
        {key: "X-Content-Type-Options", value: "nosniff"},
        // Enforce baseline restrictions; keep the broad policy report-only
        // pending full Telegram WebView and third-party iframe validation.
        {key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests"},
        {key: "Content-Security-Policy-Report-Only", value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "form-action 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          "img-src 'self' https: data: blob:",
          "connect-src 'self' https://telegram.org",
          "frame-src 'self' https://web.telegram.org https://webk.telegram.org https://webz.telegram.org https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://maps.google.com https://www.google.com",
        ].join('; ')},
        {key: "Referrer-Policy", value: "no-referrer"},
        {key: "Strict-Transport-Security", value: "max-age=31536000"},
        {key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()"},
        {key: "X-DNS-Prefetch-Control", value: "off"},
      ]},
      ...["/profile", "/admin/:path*", "/tickets/:path*", "/checkout/:path*", "/loyalty",
        "/security/:path*", "/support", "/privacy", "/organizer/:path*"].map(source => ({
        source,
        headers: [
          {key: "Cache-Control", value: "private, no-store, max-age=0"},
          {key: "X-Robots-Tag", value: "noindex, nofollow, noarchive"},
        ],
      })),
    ];
  },
};
export default nextConfig;
