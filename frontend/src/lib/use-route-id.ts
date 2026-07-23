'use client';

import { useParams } from 'next/navigation';

// تصدير Next.js الثابت (output: 'export') يُخبز فيه قيمة generateStaticParams
// (دائماً 'placeholder' هنا) داخل حالة الموجّه من جانب العميل بشكل دائم — useParams()
// تستمر بإرجاع هذه القيمة المخبوزة حتى بعد تنقّل حقيقي من جانب العميل (Link)، وليس فقط
// عند فتح رابط مباشر. لذا يجب قراءة المعرّف الفعلي من مسار المتصفح نفسه بدل الاعتماد
// على حالة الموجّه. أثناء البناء (توليد الصفحات الثابتة على الخادم) لا يوجد window، فنعود
// حينها لقيمة useParams العادية (وهي 'placeholder'، وهذا هو المتوقع في تلك المرحلة فقط).
export function useRouteId(): string {
  const params = useParams<Record<string, string>>();

  if (typeof window === 'undefined') {
    return (Object.values(params ?? {})[0] as string) ?? '';
  }

  const segments = window.location.pathname.split('/').filter(Boolean);
  const editIndex = segments.indexOf('edit');
  if (editIndex > 0) return decodeURIComponent(segments[editIndex - 1]);
  return decodeURIComponent(segments[segments.length - 1]);
}
