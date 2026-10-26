/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {source: "/:path*", headers: [
        {key: "X-Content-Type-Options", value: "nosniff"},
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
          "frame-src 'self' https://web.telegram.org https://www.youtube.com https://player.vimeo.com",
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
