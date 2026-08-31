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
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'maxFutureDate', async: false })
export class MaxFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    // allow up to 1 day (24h) in the future + 60s tolerance for test flakiness
    const max = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 60 * 1000);
    return date.getTime() <= max.getTime();
  }

  defaultMessage(): string {
    return 'date must not be more than 1 day in the future';
  }
}

export class CreateTransactionDto {
  @IsIn(['INCOME', 'EXPENSE'], { message: 'type must be INCOME or EXPENSE' })
  type!: 'INCOME' | 'EXPENSE';

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'amount must be positive' })
  amount!: number;

  @IsDateString({}, { message: 'date must be ISO 8601' })
  @Validate(MaxFutureDateConstraint, { message: 'date must not be more than 1 day in the future' })
  date!: string;

  @IsString()
  @IsNotEmpty({ message: 'description is required' })
  @MaxLength(255, { message: 'description must be at most 255 characters' })
  description!: string;

  @IsString()
  @IsNotEmpty({ message: 'accountId is required' })
  accountId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
