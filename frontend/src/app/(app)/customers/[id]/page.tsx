import PageClient from './page-client';

// مطلوب لبناء التصدير الثابت (output: export) لتطبيق Electron: المكوّن الفعلي في
// page-client.tsx يقرأ المعرّف الحقيقي في المتصفح عبر useParams()، والتنقّل بينها
// يتم دائماً من داخل التطبيق (تنقّل جانب العميل)، وليس بفتح رابط مباشر بمعرّف عشوائي.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <PageClient />;
}
