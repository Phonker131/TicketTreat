/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {source: "/:path*", headers: [
        {key: "X-Content-Type-Options", value: "nosniff"},
        {key: "Referrer-Policy", value: "no-referrer"},
        {key: "Strict-Transport-Security", value: "max-age=31536000"},
        {key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()"},
        {key: "X-DNS-Prefetch-Control", value: "off"},
      ]},
      ...["/profile", "/admin/:path*", "/tickets/:path*", "/checkout/:path*"].map(source => ({
        source,
        headers: [{key: "Cache-Control", value: "private, no-store, max-age=0"}],
      })),
    ];
  },
};
export default nextConfig;
