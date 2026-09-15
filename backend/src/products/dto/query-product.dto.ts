import { IsOptional, IsString } from 'class-validator';

export class QueryProductDto {
  @IsOptional()
  @IsString()
  search?: string; // اسم أو كود داخلي

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @IsOptional()
  @IsString()
  lowStock?: string; // 'true' لعرض المنتجات قليلة المخزون فقط
}
