import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '../common/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { UnitsService } from './units.service';
import { UnitDto } from './dto/unit.dto';

@Controller('units')
export class UnitsController {
  constructor(private service: UnitsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: UnitDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UnitDto) {
    return this.service.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
