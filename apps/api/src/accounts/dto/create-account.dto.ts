import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @ApiProperty({ example: 'Carteira' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: AccountType, example: 'WALLET' })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiProperty({ required: false, example: '#22c55e' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
