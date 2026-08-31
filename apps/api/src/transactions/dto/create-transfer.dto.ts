import type { ValidationArguments } from 'class-validator';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { MaxFutureDateConstraint } from './create-transaction.dto';

@ValidatorConstraint({ name: 'differentAccounts', async: false })
export class DifferentAccountsConstraint implements ValidatorConstraintInterface {
  validate(_value: string, args: ValidationArguments): boolean {
    const obj = args.object as CreateTransferDto;
    return obj.fromAccountId !== obj.toAccountId;
  }
  defaultMessage(): string {
    return 'fromAccountId must be different from toAccountId';
  }
}

export class CreateTransferDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'amount must be positive' })
  amount!: number;

  @IsString()
  @IsNotEmpty({ message: 'fromAccountId is required' })
  fromAccountId!: string;

  @IsString()
  @IsNotEmpty({ message: 'toAccountId is required' })
  @Validate(DifferentAccountsConstraint, { message: 'fromAccountId must be different from toAccountId' })
  toAccountId!: string;

  @IsOptional()
  @IsDateString({}, { message: 'date must be ISO 8601' })
  @Validate(MaxFutureDateConstraint, { message: 'date must not be more than 1 day in the future' })
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'description must be at most 255 characters' })
  description?: string;
}
