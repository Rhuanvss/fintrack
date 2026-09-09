import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertBudgetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'categoryId is required' })
  categoryId!: string;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt({ message: 'month must be an integer' })
  @Min(1, { message: 'month must be at least 1' })
  @Max(12, { message: 'month must be at most 12' })
  month!: number;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt({ message: 'year must be an integer' })
  @Min(2000, { message: 'year must be at least 2000' })
  @Max(2100, { message: 'year must be at most 2100' })
  year!: number;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must have at most 2 decimal places' })
  @Min(0, { message: 'amount must be non-negative' })
  amount!: number;
}
