import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { ByCategoryReportsDto } from './dto/by-category-reports.dto';
import { EvolutionReportsDto } from './dto/evolution-reports.dto';
import { SummaryReportsDto } from './dto/summary-reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(
    @CurrentUser() user: JwtPayload,
    @Query() query: SummaryReportsDto,
  ): ReturnType<ReportsService['summary']> {
    return this.reportsService.summary(user.sub, query);
  }

  @Get('by-category')
  byCategory(
    @CurrentUser() user: JwtPayload,
    @Query() query: ByCategoryReportsDto,
  ): ReturnType<ReportsService['byCategory']> {
    return this.reportsService.byCategory(user.sub, query);
  }

  @Get('evolution')
  evolution(
    @CurrentUser() user: JwtPayload,
    @Query() query: EvolutionReportsDto,
  ): ReturnType<ReportsService['evolution']> {
    return this.reportsService.evolution(user.sub, query);
  }

  @Get('balances')
  balances(@CurrentUser() user: JwtPayload): ReturnType<ReportsService['balances']> {
    return this.reportsService.balances(user.sub);
  }
}
