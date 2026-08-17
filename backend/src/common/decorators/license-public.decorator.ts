import { SetMetadata } from '@nestjs/common';

// منفصل عمداً عن @Public() (common/decorators/public.decorator.ts): @Public() يُعفي
// من التحقق من هوية المستخدم (JWT) فقط، بينما @LicensePublic() يُعفي من بوابة
// الترخيص/الفترة التجريبية فقط. لهما نطاقان مختلفان تماماً — مثلاً /auth/login مُعفى
// من الأول (يُستخدم قبل تسجيل الدخول) لكن ليس من الثاني (يجب حجبه أيضاً عند انتهاء
// الفترة التجريبية، حتى لا يصل المستخدم لشاشة الدخول أصلاً)، بينما /license/* وَ/health
// مُعفيان من الثاني تحديداً لأنهما الطريق الوحيد لعرض/تفعيل الترخيص ولفحص صحة الخادم
// أثناء إقلاع Electron، بصرف النظر عن حالة الترخيص
export const IS_LICENSE_PUBLIC_KEY = 'isLicensePublic';
export const LicensePublic = () => SetMetadata(IS_LICENSE_PUBLIC_KEY, true);
