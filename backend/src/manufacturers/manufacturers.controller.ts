import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '../common/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { ManufacturersService } from './manufacturers.service';
import { ManufacturerDto } from './dto/manufacturer.dto';

@Controller('manufacturers')
export class ManufacturersController {
  constructor(private service: ManufacturersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: ManufacturerDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ManufacturerDto) {
    return this.service.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
