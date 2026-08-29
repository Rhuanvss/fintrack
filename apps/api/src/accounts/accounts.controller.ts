import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

interface Account {
  id: string;
  name: string;
  userId: string;
}

const accountsStore = new Map<string, Account>();
let accountSeq = 1;

export function __resetAccountsStore(): void {
  accountsStore.clear();
  accountSeq = 1;
}

@Controller('accounts')
export class AccountsController {
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string },
  ): Account {
    const id = `acc_${accountSeq++}`;
    const account: Account = {
      id,
      name: body.name ?? `Account ${id}`,
      userId: user.sub,
    };
    accountsStore.set(id, account);
    return account;
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload): { userId: string; accounts: Account[] } {
    const accounts = Array.from(accountsStore.values()).filter((a) => a.userId === user.sub);
    return { userId: user.sub, accounts };
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string): Account {
    const account = accountsStore.get(id);
    if (!account || account.userId !== user.sub) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }
}
