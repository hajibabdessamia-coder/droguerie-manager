import PageClient from './page-client';

// مطلوب لبناء التصدير الثابت (output: export) لتطبيق Electron: قيمة 'placeholder' هي
// شكل واحد فقط يُصدَّر لكل مسار ديناميكي. المكوّن الفعلي في page-client.tsx يقرأ المعرّف
// الحقيقي من مسار المتصفح مباشرة (راجع src/lib/use-route-id.ts) لأن useParams() يبقى
// عالقاً على قيمة البناء هذه حتى بعد تنقّل حقيقي من جانب العميل (Link) — وليس فقط عند
// فتح رابط مباشر كما افتُرض سابقاً.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <PageClient />;
}
