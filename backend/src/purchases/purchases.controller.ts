import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@Roles(Role.ADMIN)
export class PurchasesController {
  constructor(private service: PurchasesService) {}

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreatePurchaseDto) {
    return this.service.create(userId, dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
