import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  internalCode: string;

  // ليس مقيَّداً بصيغة EAN-13 وحدها عمداً: المنتجات المُصنَّعة خارجياً قد تحمل UPC-A
  // (12 رقماً)، EAN-8، أو صيغة أخرى مطبوعة مسبقاً على عبوتها — القيد الوحيد هنا هو
  // شكل عام معقول (أرقام/حروف). توليد EAN-13 الصحيح (زر "توليد" في الواجهة) يبقى
  // مضموناً بنفسه عبر barcode.util.ts بصرف النظر عن هذا القيد
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z-]{1,32}$/)
  barcode?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retailPrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wholesalePrice: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
