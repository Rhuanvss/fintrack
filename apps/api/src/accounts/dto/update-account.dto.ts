import { IsEnum, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountType } from '@prisma/client';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsHexColor()
  color?: string;
}
