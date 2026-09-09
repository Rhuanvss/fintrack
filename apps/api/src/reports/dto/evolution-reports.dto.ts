import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EvolutionReportsDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'from must be ISO 8601' })
  @IsNotEmpty({ message: 'from is required' })
  from!: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString({}, { message: 'to must be ISO 8601' })
  @IsNotEmpty({ message: 'to is required' })
  to!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
