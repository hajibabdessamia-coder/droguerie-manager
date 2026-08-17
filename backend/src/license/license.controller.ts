import { Body, Controller, Get, Post } from '@nestjs/common';
import { LicensePublic } from '../common/decorators/license-public.decorator';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { LicenseService } from './license.service';

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
