import { ApiProperty } from '@nestjs/swagger';
import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Alimentação' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ required: false, example: '#22c55e' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiProperty({ required: false, example: 'food' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
