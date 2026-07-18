import { IsString, MinLength } from 'class-validator';

export class ManufacturerDto {
  @IsString()
  @MinLength(2)
  name: string;
}
