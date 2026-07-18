import { IsInt, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  @IsInt()
  delta: number; // موجب للإضافة، سالب للخصم

  @IsOptional()
  @IsString()
  reason?: string;
}
