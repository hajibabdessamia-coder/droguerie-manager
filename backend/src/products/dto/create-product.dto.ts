import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ProductGroup } from '../../common/enums';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  internalCode: string;

  @IsOptional()
  @IsEnum(ProductGroup)
  group?: ProductGroup;

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
