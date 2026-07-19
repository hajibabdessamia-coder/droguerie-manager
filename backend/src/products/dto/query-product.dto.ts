import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProductGroup } from '../../common/enums';

export class QueryProductDto {
  @IsOptional()
  @IsString()
  search?: string; // اسم أو كود داخلي

  @IsOptional()
  @IsEnum(ProductGroup)
  group?: ProductGroup;

  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @IsOptional()
  @IsString()
  lowStock?: string; // 'true' لعرض المنتجات قليلة المخزون فقط
}
