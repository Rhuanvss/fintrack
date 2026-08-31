import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { BudgetsService } from './budgets.service';
import { ListBudgetsDto } from './dto/list-budgets.dto';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Put()
  upsert(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertBudgetDto,
  ): ReturnType<BudgetsService['upsert']> {
    return this.budgetsService.upsert(user.sub, dto);
  }

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListBudgetsDto,
  ): ReturnType<BudgetsService['list']> {
    return this.budgetsService.list(user.sub, { month: query.month, year: query.year });
  }
}
