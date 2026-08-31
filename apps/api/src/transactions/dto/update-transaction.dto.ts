import 'reflect-metadata';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaxFutureDateConstraint } from './create-transaction.dto';

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE'], { message: 'type must be INCOME or EXPENSE' })
  type?: 'INCOME' | 'EXPENSE';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'amount must be positive' })
  amount?: number;

  @IsOptional()
  @IsDateString({}, { message: 'date must be ISO 8601' })
  @Validate(MaxFutureDateConstraint, { message: 'date must not be more than 1 day in the future' })
  date?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'description must not be empty' })
  @MaxLength(255, { message: 'description must be at most 255 characters' })
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'accountId must not be empty' })
  accountId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'categoryId must not be empty' })
  categoryId?: string | null;
}
