import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception.code === 'P2002') {
      const target = (exception.meta?.target as string[])?.join(', ');
      return response.status(409).json({ statusCode: 409, message: `القيمة مستخدمة مسبقاً: ${target}` });
    }
    if (exception.code === 'P2025') {
      return response.status(404).json({ statusCode: 404, message: 'العنصر غير موجود' });
    }
    return response.status(400).json({ statusCode: 400, message: 'خطأ في قاعدة البيانات' });
  }
}
