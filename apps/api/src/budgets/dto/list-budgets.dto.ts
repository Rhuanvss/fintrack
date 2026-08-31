import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListBudgetsDto {
  @Type(() => Number)
  @IsInt({ message: 'month must be an integer' })
  @Min(1, { message: 'month must be at least 1' })
  @Max(12, { message: 'month must be at most 12' })
  month!: number;

  @Type(() => Number)
  @IsInt({ message: 'year must be an integer' })
  @Min(2000, { message: 'year must be at least 2000' })
  @Max(2100, { message: 'year must be at most 2100' })
  year!: number;
}
