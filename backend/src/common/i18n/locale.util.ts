import type { Request } from 'express';
import type { Locale } from './messages';

// يقرأ لغة الطلب من ?locale= (أولوية، مفيد لروابط تحميل مباشرة مثل فاتورة/تقرير PDF)
// ثم من ترويسة X-Locale (تُرفَق تلقائياً مع كل طلب من الواجهة الأمامية — راجع
// frontend/src/lib/api-client.ts)، وتفتَرض 'ar' إن غابا معاً
export function resolveLocale(req: Request): Locale {
  const queryLocale = req.query?.locale;
  if (queryLocale === 'fr') return 'fr';

  const header = req.headers['x-locale'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (headerValue === 'fr') return 'fr';

  return 'ar';
}
