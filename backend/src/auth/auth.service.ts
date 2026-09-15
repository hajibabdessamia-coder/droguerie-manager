import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS' });

    await this.audit.log(user.id, 'LOGIN', 'User', user.id);

    return {
      accessToken: this.jwt.sign({ sub: user.id, email: user.email, role: user.role, type: 'access' }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  // يتحقق من هوية المدير دون إنهاء جلسة البائع الحالية، ويصدر رمزاً قصير الأجل
  // يرفق مع عملية بيع تحتوي سعراً معدلاً يدوياً (PriceType.CUSTOM)
  async authorizeOverride(email: string, password: string) {
    const admin = await this.prisma.user.findUnique({ where: { email } });
    if (!admin || !admin.isActive || admin.role !== 'ADMIN') {
      throw new UnauthorizedException({ code: 'AUTH_ADMIN_REQUIRED' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS' });

    const overrideToken = this.jwt.sign(
      { sub: admin.id, email: admin.email, role: admin.role, type: 'override' },
      { expiresIn: '5m' },
    );
    return { overrideToken };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException({ code: 'AUTH_USER_NOT_FOUND' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException({ code: 'AUTH_CURRENT_PASSWORD_INVALID' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await this.audit.log(userId, 'UPDATE', 'User', userId, 'تغيير كلمة المرور');

    return { ok: true };
  }

  async changeEmail(userId: string, currentPassword: string, newEmail: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException({ code: 'AUTH_USER_NOT_FOUND' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException({ code: 'AUTH_CURRENT_PASSWORD_INVALID' });

    if (newEmail !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
      if (existing) throw new ConflictException({ code: 'AUTH_EMAIL_TAKEN' });
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data: { email: newEmail } });
    await this.audit.log(userId, 'UPDATE', 'User', userId, 'تغيير البريد الإلكتروني');

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      mustChangePassword: updated.mustChangePassword,
    };
  }
}
