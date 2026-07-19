/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // تصدير ثابت: يبني "out/" ليُخدَّم من خادم محلي صغير داخل تطبيق Electron.
  // لا يؤثر على "next dev" أثناء التطوير المحلي — فقط على ناتج "next build".
  ...(process.env.BUILD_TARGET === 'electron' ? { output: 'export' } : {}),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    unoptimized: true,
  },
};

export default nextConfig;
