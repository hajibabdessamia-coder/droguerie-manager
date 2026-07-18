import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStoreSettingsDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() ifNumber?: string;
  @IsOptional() @IsString() ice?: string;
  @IsOptional() @IsString() rc?: string;
  @IsOptional() @IsString() patente?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultTaxRate?: number;
}
