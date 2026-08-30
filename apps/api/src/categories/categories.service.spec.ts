import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService - task 2.9', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    transaction: {
      count: jest.Mock;
      updateMany: jest.Mock;
    };
    budget: {
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      category: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      budget: {
        count: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };

    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('create categoria raiz com sucesso', async () => {
    prisma.category.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null); // parent check (null) + duplicate check
    const created = { id: 'cat_1', name: 'Alimentação', color: '#FF6B6B', icon: 'utensils', parentId: null, userId: 'user_1', createdAt: new Date(), updatedAt: new Date() };
    prisma.category.create.mockResolvedValue(created as never);

    const result = await service.create('user_1', { name: 'Alimentação', color: '#FF6B6B', icon: 'utensils' });
    expect(result.name).toBe('Alimentação');
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Alimentação', color: '#FF6B6B', icon: 'utensils', parentId: null, userId: 'user_1' },
    });
  });

  it('create subcategoria com parent válido', async () => {
    const parent = { id: 'parent_1', name: 'Alimentação', parentId: null, userId: 'user_1' };
    prisma.category.findFirst.mockResolvedValueOnce(parent as never).mockResolvedValueOnce(null);
    const created = { id: 'cat_2', name: 'Delivery', color: null, icon: null, parentId: 'parent_1', userId: 'user_1', createdAt: new Date(), updatedAt: new Date() };
    prisma.category.create.mockResolvedValue(created as never);

    const result = await service.create('user_1', { name: 'Delivery', parentId: 'parent_1' });
    expect(result.parentId).toBe('parent_1');
  });

  it('create duplicate nome no mesmo parent 409 case-insensitive', async () => {
    prisma.category.findFirst.mockResolvedValueOnce({ id: 'existing', name: 'Alimentação', parentId: null, userId: 'user_1' } as never);
    await expect(service.create('user_1', { name: 'alimentação' })).rejects.toThrow(ConflictException);
    prisma.category.findFirst.mockReset();
    // mesmo nome mas parent diferente deve passar
    prisma.category.findFirst.mockResolvedValueOnce({ id: 'parent_2', name: 'Transporte', parentId: null, userId: 'user_1' } as never).mockResolvedValueOnce(null);
    prisma.category.create.mockResolvedValue({ id: 'cat_3', name: 'Alimentação', parentId: 'parent_2', userId: 'user_1' } as never);
    await expect(service.create('user_1', { name: 'Alimentação', parentId: 'parent_2' })).resolves.toBeDefined();
  });

  it('create com parent que já é filho deve falhar 400 (apenas 1 nível)', async () => {
    const parentChild = { id: 'child_1', name: 'Delivery', parentId: 'parent_1', userId: 'user_1' };
    prisma.category.findFirst.mockResolvedValue(parentChild as never);
    await expect(service.create('user_1', { name: 'Sub', parentId: 'child_1' })).rejects.toThrow(BadRequestException);
  });

  it('create com parent inexistente 404', async () => {
    prisma.category.findFirst.mockResolvedValue(null as never);
    await expect(service.create('user_1', { name: 'X', parentId: 'nope' })).rejects.toThrow(NotFoundException);
  });

  it('remove com transações sem reassignTo 409', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat_1', name: 'A', parentId: null, userId: 'user_1' } as never);
    prisma.transaction.count.mockResolvedValue(2 as never);
    prisma.budget.count.mockResolvedValue(0 as never);
    await expect(service.remove('cat_1', 'user_1')).rejects.toThrow(ConflictException);
  });

  it('remove com reassignTo reatribui e deleta', async () => {
    prisma.category.findFirst.mockResolvedValueOnce({ id: 'cat_1', name: 'A', parentId: null, userId: 'user_1' } as never).mockResolvedValueOnce({ id: 'cat_2', name: 'B', parentId: null, userId: 'user_1' } as never);
    prisma.transaction.count.mockResolvedValue(2 as never);
    prisma.budget.count.mockResolvedValue(0 as never);
    prisma.transaction.updateMany.mockResolvedValue({ count: 2 } as never);
    prisma.category.delete.mockResolvedValue({ id: 'cat_1' } as never);

    const result = await service.remove('cat_1', 'user_1', 'cat_2');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({ where: { categoryId: 'cat_1', userId: 'user_1' }, data: { categoryId: 'cat_2' } });
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat_1' } });
    expect(result.id).toBe('cat_1');
  });

  it('remove com orçamentos vinculados 409', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat_1', name: 'A', parentId: null, userId: 'user_1' } as never);
    prisma.transaction.count.mockResolvedValue(0 as never);
    prisma.budget.count.mockResolvedValue(1 as never);
    await expect(service.remove('cat_1', 'user_1')).rejects.toThrow(ConflictException);
  });

  it('remove sem transações nem orçamentos deleta direto', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat_1', name: 'A', parentId: null, userId: 'user_1' } as never);
    prisma.transaction.count.mockResolvedValue(0 as never);
    prisma.budget.count.mockResolvedValue(0 as never);
    prisma.category.delete.mockResolvedValue({ id: 'cat_1' } as never);

    const result = await service.remove('cat_1', 'user_1');
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat_1' } });
    expect(result.id).toBe('cat_1');
  });
});
