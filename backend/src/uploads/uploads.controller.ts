import { BadRequestException, Controller, Inject, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '../common/enums';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { STORAGE_SERVICE, StorageService } from './storage.interface';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('uploads')
@Roles(Role.ADMIN)
export class UploadsController {
  constructor(@Inject(STORAGE_SERVICE) private storage: StorageService) {}

  @Post('product-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException({ code: 'UPLOAD_INVALID_IMAGE_FORMAT' }), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException({ code: 'UPLOAD_FILE_REQUIRED' });
    const url = await this.storage.uploadImage(file, 'products');
    return { url };
  }
}
