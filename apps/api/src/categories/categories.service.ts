import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<{
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    parentId: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const parentId = dto.parentId ?? null;

    if (parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: parentId, userId },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
      if (parent.parentId) {
        throw new BadRequestException('Only 1 level of hierarchy allowed');
      }
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        userId,
        parentId,
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException('Category name already exists at this level');
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        color: dto.color ?? null,
        icon: dto.icon ?? null,
        parentId,
        userId,
      },
    });
  }

  findAll(userId: string): Promise<
    {
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
      parentId: string | null;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    }[]
  > {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findOne(id: string, userId: string): Promise<{
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    parentId: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateCategoryDto,
  ): Promise<{
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    parentId: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const newParentId = dto.parentId !== undefined ? dto.parentId : existing.parentId;
    const newName = dto.name ?? existing.name;

    if (newParentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: newParentId, userId },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
      if (parent.parentId) {
        throw new BadRequestException('Only 1 level of hierarchy allowed');
      }
      if (newParentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
    }

    if (newName !== existing.name || newParentId !== existing.parentId) {
      const duplicate = await this.prisma.category.findFirst({
        where: {
          userId,
          parentId: newParentId,
          name: { equals: newName, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException('Category name already exists at this level');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.parentId !== undefined) data.parentId = dto.parentId;

    return this.prisma.category.update({
      where: { id },
      data: data as never,
    });
  }

  async remove(id: string, userId: string, reassignTo?: string): Promise<{ id: string }> {
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const txCount = await this.prisma.transaction.count({
      where: { categoryId: id, userId },
    });

    if (txCount > 0 && !reassignTo) {
      throw new ConflictException('Category has transactions, reassignTo is required');
    }

    if (reassignTo) {
      const target = await this.prisma.category.findFirst({
        where: { id: reassignTo, userId },
      });
      if (!target) {
        throw new NotFoundException('Target category not found');
      }
      if (reassignTo === id) {
        throw new BadRequestException('Cannot reassign to same category');
      }
      await this.prisma.transaction.updateMany({
        where: { categoryId: id, userId },
        data: { categoryId: reassignTo },
      });
    }

    const budgetCount = await this.prisma.budget.count({
      where: { categoryId: id, userId },
    });
    if (budgetCount > 0) {
      throw new ConflictException('Category has budgets, delete or update them first');
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return { id };
  }
}
