import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { InvoiceType, PaymentMethod, PriceType } from '@prisma/client';

class SaleItemDto {
  @IsString()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsEnum(PriceType)
  priceType: PriceType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customPrice?: number; // مطلوب فقط إذا priceType = CUSTOM
}

export class CreateSaleDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsEnum(InvoiceType)
  invoiceType: InvoiceType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount = 0;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate = 0;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid: number;

  @IsOptional()
  @IsString()
  overrideToken?: string; // مطلوب إذا كان أي عنصر بسعر CUSTOM

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}
