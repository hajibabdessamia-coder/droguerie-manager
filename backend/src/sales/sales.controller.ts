import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { Role } from '../common/enums';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { resolveLocale } from '../common/i18n/locale.util';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private service: SalesService) {}

  @Post()
  create(@CurrentUser('userId') sellerId: string, @Body() dto: CreateSaleDto) {
    return this.service.create(sellerId, dto);
  }

  @Get()
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findAll(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.generateInvoicePdf(id, resolveLocale(req));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSaleDto) {
    return this.service.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/returns')
  createReturn(@Param('id') id: string, @CurrentUser('userId') userId: string, @Body() dto: CreateSaleReturnDto) {
    return this.service.createReturn(id, userId, dto);
  }
}
