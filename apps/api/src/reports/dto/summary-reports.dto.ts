import { IsDateString, IsNotEmpty } from 'class-validator';

export class SummaryReportsDto {
  @IsDateString({}, { message: 'from must be ISO 8601' })
  @IsNotEmpty({ message: 'from is required' })
  from!: string;

  @IsDateString({}, { message: 'to must be ISO 8601' })
  @IsNotEmpty({ message: 'to is required' })
  to!: string;
}
