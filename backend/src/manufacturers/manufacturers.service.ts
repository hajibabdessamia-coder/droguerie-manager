import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ManufacturerDto } from './dto/manufacturer.dto';

@Injectable()
export class ManufacturersService {
  constructor(private prisma: PrismaService) {}

  create(dto: ManufacturerDto) {
    return this.prisma.manufacturer.create({ data: dto });
  }

  findAll() {
    return this.prisma.manufacturer.findMany({ orderBy: { name: 'asc' } });
  }

  async update(id: string, dto: ManufacturerDto) {
    await this.ensureExists(id);
    return this.prisma.manufacturer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.manufacturer.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.manufacturer.findUnique({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'MANUFACTURER_NOT_FOUND' });
  }
}
