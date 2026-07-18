import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import { StoreSettingsService } from './store-settings.service';

@Controller('store-settings')
export class StoreSettingsController {
  constructor(private service: StoreSettingsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Roles(Role.ADMIN)
  @Patch()
  update(@Body() dto: UpdateStoreSettingsDto) {
    return this.service.update(dto);
  }
}
