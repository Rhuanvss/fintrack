import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

// Placeholder PrismaService for task 1.3.
// Real PrismaClient integration comes in task 1.4 after `prisma init`.
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  onModuleInit(): void {
    // Intentionally empty — no DB connection in scaffold phase
  }

  onModuleDestroy(): void {
    // Intentionally empty
  }

  // Dummy method to prove injectability and keep TS strict happy
  getPlaceholder(): string {
    return 'prisma-placeholder';
  }
}
