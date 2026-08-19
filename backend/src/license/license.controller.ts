import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { LicensePublic } from '../common/decorators/license-public.decorator';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { LicenseService } from './license.service';

// يجب إعفاء هذين المسارين من كلا الحارسين: LicenseGuard (عبر @LicensePublic()،
// موجود مسبقاً) وJwtAuthGuard (عبر @Public()) — بدونه، جهاز انتهت صلاحية ترخيصه
// يُحجَب أيضاً عن /auth/login (بتصميم LicenseGuard)، فلا يملك JWT أبداً، ولا يمكنه
// الوصول لهذين المسارين لعرض معرّف الجهاز أو تفعيل ترخيص جديد — القفل الدائم الذي
// كان يجب أن يحله هذان المساران أصلاً
@Public()
@LicensePublic()
@Controller('license')
export class LicenseController {
  constructor(private service: LicenseService) {}

  @Get('status')
  getStatus() {
    return this.service.getStatus();
  }

  @Post('activate')
  activate(@Body() dto: ActivateLicenseDto) {
    return this.service.activate(dto.licenseKey);
  }
}
