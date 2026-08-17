import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { LicensePublic } from '../common/decorators/license-public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @LicensePublic()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
