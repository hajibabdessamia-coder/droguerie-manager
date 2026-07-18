import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';

const SETTINGS_ID = 'default';

@Injectable()
export class StoreSettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.storeSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (settings) return settings;
    return this.prisma.storeSettings.create({ data: { id: SETTINGS_ID, name: 'اسم المحل' } });
  }

  update(dto: UpdateStoreSettingsDto) {
    return this.prisma.storeSettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, name: dto.name ?? 'اسم المحل', ...dto },
    });
  }
}
