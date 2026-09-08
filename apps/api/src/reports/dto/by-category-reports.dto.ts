import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ByCategoryReportsDto {
  @IsDateString({}, { message: 'from must be ISO 8601' })
  @IsNotEmpty({ message: 'from is required' })
  from!: string;

  @IsDateString({}, { message: 'to must be ISO 8601' })
  @IsNotEmpty({ message: 'to is required' })
  to!: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
