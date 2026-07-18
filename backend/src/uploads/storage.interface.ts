export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface StorageService {
  uploadImage(file: Express.Multer.File, folder: string): Promise<string>;
}
