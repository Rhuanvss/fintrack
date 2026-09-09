import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

// Mantido para compatibilidade com auth.e2e.spec.ts que importa __resetAccountsStore
// Após migração para Prisma, o store em memória não é mais usado.
export function __resetAccountsStore(): void {
  // no-op: contas agora persistem via Prisma
}

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @ApiOperation({ summary: 'Criar conta' })
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAccountDto): ReturnType<AccountsService['create']> {
    return this.accountsService.create(user.sub, dto);
  }

  @ApiOperation({ summary: 'Listar contas com saldo' })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('includeArchived') includeArchived?: string,
  ): ReturnType<AccountsService['findAll']> {
    const include = includeArchived === 'true';
    return this.accountsService.findAll(user.sub, include);
  }

  @ApiOperation({ summary: 'Buscar conta com saldo' })
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string): ReturnType<AccountsService['findOne']> {
    return this.accountsService.findOne(id, user.sub);
  }

  @ApiOperation({ summary: 'Atualizar conta' })
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): ReturnType<AccountsService['update']> {
    return this.accountsService.update(id, user.sub, dto);
  }

  @ApiOperation({ summary: 'Arquivar conta' })
  @Patch(':id/archive')
  archive(@CurrentUser() user: JwtPayload, @Param('id') id: string): ReturnType<AccountsService['archive']> {
    return this.accountsService.archive(id, user.sub);
  }
}
