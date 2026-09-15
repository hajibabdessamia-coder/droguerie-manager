import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitDto } from './dto/unit.dto';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  create(dto: UnitDto) {
    return this.prisma.unit.create({ data: dto });
  }

  findAll() {
    return this.prisma.unit.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async update(id: string, dto: UnitDto) {
    await this.ensureExists(id);
    return this.prisma.unit.update({ where: { id }, data: dto });
  }

  // الحذف آمن دائماً: منتجات هذه الوحدة تُصبح بلا وحدة (unitId = NULL) تلقائياً عبر
  // onDelete: SetNull في schema.prisma
  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.unit.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.unit.findUnique({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'UNIT_NOT_FOUND' });
  }
}
