import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CustomerType } from '../../common/enums';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsEnum(CustomerType)
  type: CustomerType;
}
