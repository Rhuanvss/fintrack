import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOperation({ summary: 'Criar transferência atômica entre contas' })
  @Post('transfer')
  transfer(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTransferDto,
  ): ReturnType<TransactionsService['transfer']> {
    return this.transactionsService.transfer(user.sub, dto);
  }

  @ApiOperation({ summary: 'Criar transação' })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTransactionDto,
  ): ReturnType<TransactionsService['create']> {
    return this.transactionsService.create(user.sub, dto);
  }

  @ApiOperation({ summary: 'Listar transações com filtros e paginação' })
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListTransactionsDto,
  ): ReturnType<TransactionsService['list']> {
    return this.transactionsService.list(user.sub, query);
  }

  @ApiOperation({ summary: 'Buscar transação' })
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): ReturnType<TransactionsService['findOne']> {
    return this.transactionsService.findOne(id, user.sub);
  }

  @ApiOperation({ summary: 'Atualizar transação' })
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): ReturnType<TransactionsService['update']> {
    return this.transactionsService.update(id, user.sub, dto);
  }

  @ApiOperation({ summary: 'Remover transação' })
  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): ReturnType<TransactionsService['remove']> {
    return this.transactionsService.remove(id, user.sub);
  }
}
