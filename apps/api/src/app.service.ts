import { Injectable } from '@nestjs/common';
import type { User, Account, Paginated } from '@fintrack/shared';

@Injectable()
export class AppService {
  getHello(): { message: string } {
    return { message: 'Fintrack API is running' };
  }

  // Example typed usage to verify shared contract — breaks build if shared types diverge
  getExampleAccount(): Account {
    return {
      id: 'acc_1',
      name: 'Carteira',
      type: 'WALLET',
      color: '#00FF00',
      isArchived: false,
      userId: 'user_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      balance: 0,
    };
  }

  getExamplePaginated(): Paginated<User> {
    return {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      hasNext: false,
    };
  }
}
