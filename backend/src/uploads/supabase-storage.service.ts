import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { StorageService } from './storage.interface';

const BUCKET = 'product-images';

// تخزين سحابي عبر Supabase Storage — بديل لـ LocalStorageService عند التشغيل على استضافة
// بقرص غير دائم (مثل Render). يطبّق نفس StorageService دون أي تغيير في بقية الكود.
@Injectable()
export class SupabaseStorageService implements StorageService {
  private client;

  constructor(private config: ConfigService) {
    this.client = createClient(
      this.config.get<string>('SUPABASE_URL') as string,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') as string,
    );
  }

  async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
    const filename = `${folder}/${randomUUID()}${extname(file.originalname)}`;

    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(filename, file.buffer, { contentType: file.mimetype });
    if (error) throw error;

    const { data } = this.client.storage.from(BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  }
}
