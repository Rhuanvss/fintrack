import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { ByCategoryReportsDto } from './dto/by-category-reports.dto';
import { EvolutionReportsDto } from './dto/evolution-reports.dto';
import { SummaryReportsDto } from './dto/summary-reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Resumo financeiro do período' })
  @Get('summary')
  summary(
    @CurrentUser() user: JwtPayload,
    @Query() query: SummaryReportsDto,
  ): ReturnType<ReportsService['summary']> {
    return this.reportsService.summary(user.sub, query);
  }

  @ApiOperation({ summary: 'Gastos agrupados por categoria' })
  @Get('by-category')
  byCategory(
    @CurrentUser() user: JwtPayload,
    @Query() query: ByCategoryReportsDto,
  ): ReturnType<ReportsService['byCategory']> {
    return this.reportsService.byCategory(user.sub, query);
  }

  @ApiOperation({ summary: 'Evolução mensal de receitas e despesas' })
  @Get('evolution')
  evolution(
    @CurrentUser() user: JwtPayload,
    @Query() query: EvolutionReportsDto,
  ): ReturnType<ReportsService['evolution']> {
    return this.reportsService.evolution(user.sub, query);
  }

  @ApiOperation({ summary: 'Saldo atual por conta' })
  @Get('balances')
  balances(@CurrentUser() user: JwtPayload): ReturnType<ReportsService['balances']> {
    return this.reportsService.balances(user.sub);
  }
}
