/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // تصدير ثابت: يبني "out/" ليُخدَّم من خادم محلي صغير داخل تطبيق Electron.
  // لا يؤثر على "next dev" أثناء التطوير المحلي — فقط على ناتج "next build".
  ...(process.env.BUILD_TARGET === 'electron'
    ? {
        output: 'export',
        // يفرض منفذ الخادم الخلفي الثابت داخل Electron (راجع electron/main.js:
        // BACKEND_PORT) بغض النظر عمّا في frontend/.env.local — ذاك الملف مخصص
        // لـ "next dev" العادي (يشير لمنفذ خادم التطوير المحلي 3001) وكان يتجاوز
        // أي قيمة NEXT_PUBLIC_API_URL أُمرِّرها من سطر الأوامر عند بناء نسخة
        // Electron، فتُخبَز الواجهة بمنفذ خاطئ لا يستمع عليه أي شيء داخل التطبيق
        // المُعبّأ — هذا بالضبط ما سبّب خطأ "تعذّر الاتصال بالخادم" عند تسجيل الدخول
        env: {
          NEXT_PUBLIC_API_URL: 'http://127.0.0.1:34115/api',
        },
      }
    : {}),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    unoptimized: true,
  },
};

export default nextConfig;
