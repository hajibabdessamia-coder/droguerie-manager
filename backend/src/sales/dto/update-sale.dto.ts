import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { InvoiceType, PaymentMethod } from '@prisma/client';

// تعديل محدود لفاتورة بيع سابقة: لا يلمس المنتجات أو الكميات أو المخزون إطلاقاً
export class UpdateSaleDto {
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid?: number;
}
