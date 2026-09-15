import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { resolveLocale } from '../i18n/locale.util';
import { translate } from '../i18n/messages';

// مرشِّحة عامة تترجم كل استثناء HTTP قبل إرساله للعميل. الخدمات ترمي استثناءً بشكل
// `new NotFoundException({ code: 'PRODUCT_NOT_FOUND' })` (رمز + معاملات اختيارية) بدل
// نص جاهز — راجع common/i18n/messages.ts لقائمة الرموز. أي استثناء لا يحمل `code` معروفاً
// (مثال: { code: 'LICENSE_REQUIRED', state } من LicenseGuard، الذي تقرأه الواجهة الأمامية
// بنيوياً لا كنص) يُمرَّر كما هو دون تعديل.
@Catch(HttpException)
export class I18nHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const locale = resolveLocale(request);
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (body && typeof body === 'object' && 'code' in body) {
      const { code, params } = body as { code: string; params?: Record<string, string> };
      const translated = translate(code, locale, params);
      if (translated) {
        return response.status(status).json({ statusCode: status, message: translated });
      }
      // رمز غير معروف في القاموس (مثال: LICENSE_REQUIRED) — يُمرَّر كاملاً كما هو
      return response.status(status).json(body);
    }

    if (body && typeof body === 'object' && Array.isArray((body as { message?: unknown }).message)) {
      // أخطاء تحقق class-validator: مصفوفة رسائل إنجليزية افتراضياً — تُستبدَل برسالة
      // عامة مترجمة بدل تسريب نص إنجليزي أو تفاصيل تقنية للمستخدم مباشرة
      const translated = translate('VALIDATION_FAILED', locale) ?? 'Invalid data';
      return response.status(status).json({ statusCode: status, message: translated });
    }

    // استثناء عادي (نص NestJS الافتراضي مثل "Unauthorized" بلا رسالة مخصصة، أو استثناء
    // لم يُحوَّل بعد لرمز) — يُمرَّر كما هو
    return response.status(status).json(body);
  }
}
