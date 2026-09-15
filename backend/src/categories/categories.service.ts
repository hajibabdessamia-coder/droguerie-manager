import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  findAll() {
    return this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async update(id: string, dto: CategoryDto) {
    await this.ensureExists(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  // الحذف آمن دائماً: منتجات هذه الفئة تُصبح بلا فئة (categoryId = NULL) تلقائياً عبر
  // onDelete: SetNull في schema.prisma، بدل رفض الحذف أو حذف المنتجات نفسها
  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.category.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.category.findUnique({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND' });
  }
}
