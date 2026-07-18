import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { StorageService } from './storage.interface';

// تخزين محلي على القرص لبيئة التطوير. عند النشر يمكن استبدال هذا الموفّر
// بموفّر Cloudinary أو S3 يطبّق نفس StorageService دون تعديل بقية الكود.
@Injectable()
export class LocalStorageService implements StorageService {
  constructor(private config: ConfigService) {}

  async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
    const dir = join(process.cwd(), 'uploads', folder);
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}${extname(file.originalname)}`;
    await writeFile(join(dir, filename), file.buffer);

    const baseUrl = this.config.get<string>('PUBLIC_URL', 'http://localhost:3001');
    return `${baseUrl}/uploads/${folder}/${filename}`;
  }
}
