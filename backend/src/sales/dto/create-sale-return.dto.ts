import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class SaleReturnItemDto {
  @IsString()
  saleItemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateSaleReturnDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleReturnItemDto)
  items: SaleReturnItemDto[];
}
