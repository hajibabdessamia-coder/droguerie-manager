import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { STORAGE_SERVICE } from './storage.interface';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [
    {
      provide: STORAGE_SERVICE,
      useFactory: (config: ConfigService) =>
        config.get<string>('STORAGE_PROVIDER') === 'supabase'
          ? new SupabaseStorageService(config)
          : new LocalStorageService(config),
      inject: [ConfigService],
    },
  ],
})
export class UploadsModule {}
