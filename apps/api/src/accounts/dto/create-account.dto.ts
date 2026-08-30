import { IsEnum, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsOptional()
  @IsHexColor()
  color?: string;
}
