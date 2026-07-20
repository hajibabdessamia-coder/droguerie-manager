import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Role } from '../common/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { BackupService } from './backup.service';

@Roles(Role.ADMIN)
@Controller('backups')
export class BackupController {
  constructor(private service: BackupService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create() {
    return this.service.create();
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get('open-folder')
  openFolder() {
    return this.service.openFolder();
  }
}
