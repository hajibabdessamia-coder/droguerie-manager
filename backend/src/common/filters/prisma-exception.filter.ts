import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { resolveLocale } from '../i18n/locale.util';
import { translate } from '../i18n/messages';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const locale = resolveLocale(ctx.getRequest<Request>());

    if (exception.code === 'P2002') {
      const target = (exception.meta?.target as string[])?.join(', ');
      return response.status(409).json({ statusCode: 409, message: translate('DB_DUPLICATE_VALUE', locale, { target }) });
    }
    if (exception.code === 'P2025') {
      return response.status(404).json({ statusCode: 404, message: translate('DB_RECORD_NOT_FOUND', locale) });
    }
    return response.status(400).json({ statusCode: 400, message: translate('DB_ERROR', locale) });
  }
}
