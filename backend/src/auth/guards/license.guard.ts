import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_LICENSE_PUBLIC_KEY } from '../../common/decorators/license-public.decorator';
import { LicenseService } from '../../license/license.service';

// بوابة مركزية واحدة لكل الوصول للتطبيق (المتطلب: "استخدم بوابة وصول/ترخيص مركزية
// بدل تعديل منطق العمل") — مسجَّلة كأول APP_GUARD في app.module.ts، قبل JwtAuthGuard
// وRolesGuard، حتى يُحجَب الجهاز غير المرخَّص قبل أن يصل حتى لشاشة تسجيل الدخول
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private licenseService: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isLicensePublic = this.reflector.getAllAndOverride<boolean>(IS_LICENSE_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isLicensePublic) return true;

    const status = await this.licenseService.getStatus();
    if (status.state === 'LICENSED' || status.state === 'TRIAL_ACTIVE') return true;

    throw new ForbiddenException({ code: 'LICENSE_REQUIRED', state: status.state });
  }
}
