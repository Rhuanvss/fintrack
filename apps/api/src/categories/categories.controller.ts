import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'Criar categoria' })
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCategoryDto): ReturnType<CategoriesService['create']> {
    return this.categoriesService.create(user.sub, dto);
  }

  @ApiOperation({ summary: 'Listar categorias' })
  @Get()
  findAll(@CurrentUser() user: JwtPayload): ReturnType<CategoriesService['findAll']> {
    return this.categoriesService.findAll(user.sub);
  }

  @ApiOperation({ summary: 'Buscar categoria' })
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string): ReturnType<CategoriesService['findOne']> {
    return this.categoriesService.findOne(id, user.sub);
  }

  @ApiOperation({ summary: 'Atualizar categoria' })
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): ReturnType<CategoriesService['update']> {
    return this.categoriesService.update(id, user.sub, dto);
  }

  @ApiOperation({ summary: 'Remover categoria (com reatribuição opcional)' })
  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('reassignTo') reassignTo?: string,
  ): ReturnType<CategoriesService['remove']> {
    return this.categoriesService.remove(id, user.sub, reassignTo);
  }
}
