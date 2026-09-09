import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class SummaryReportsDto {
  @ApiProperty({ example: '2026-08-01' })
  @IsDateString({}, { message: 'from must be ISO 8601' })
  @IsNotEmpty({ message: 'from is required' })
  from!: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString({}, { message: 'to must be ISO 8601' })
  @IsNotEmpty({ message: 'to is required' })
  to!: string;
}
