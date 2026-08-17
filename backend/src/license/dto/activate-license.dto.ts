import { IsString, MinLength } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @MinLength(1)
  licenseKey: string;
}
