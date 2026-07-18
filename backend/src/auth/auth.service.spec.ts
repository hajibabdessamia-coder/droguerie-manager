import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

const ADMIN = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@shop.local',
  role: 'ADMIN',
  isActive: true,
  passwordHash: 'hashed',
};

const SELLER = { ...ADMIN, id: 'seller-1', role: 'SELLER' };

function buildService(user: typeof ADMIN | null) {
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  const jwt = { sign: jest.fn().mockReturnValue('signed-token') };
  const audit = { log: jest.fn() };
  const service = new AuthService(prisma as never, jwt as never, audit as never);
  return { service, prisma, jwt, audit };
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.spyOn(bcrypt, 'compare').mockImplementation(async (plain) => plain === 'correct-password');
  });

  afterEach(() => jest.restoreAllMocks());

  describe('login', () => {
    it('throws when the user does not exist', async () => {
      const { service } = buildService(null);
      await expect(service.login('nobody@shop.local', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when the password is wrong', async () => {
      const { service } = buildService(ADMIN);
      await expect(service.login(ADMIN.email, 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when the account is deactivated', async () => {
      const { service } = buildService({ ...ADMIN, isActive: false });
      await expect(service.login(ADMIN.email, 'correct-password')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns an access token and sanitized user on success', async () => {
      const { service, audit } = buildService(ADMIN);
      const result = await service.login(ADMIN.email, 'correct-password');
      expect(result.accessToken).toBe('signed-token');
      expect(result.user).toEqual({ id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: ADMIN.role });
      expect(audit.log).toHaveBeenCalledWith(ADMIN.id, 'LOGIN', 'User', ADMIN.id);
    });
  });

  describe('authorizeOverride', () => {
    it('throws when the account is not an ADMIN', async () => {
      const { service } = buildService(SELLER);
      await expect(service.authorizeOverride(SELLER.email, 'correct-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when the password is wrong even for an admin', async () => {
      const { service } = buildService(ADMIN);
      await expect(service.authorizeOverride(ADMIN.email, 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('issues a short-lived override token for a valid admin', async () => {
      const { service, jwt } = buildService(ADMIN);
      const result = await service.authorizeOverride(ADMIN.email, 'correct-password');
      expect(result.overrideToken).toBe('signed-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: ADMIN.id, role: 'ADMIN', type: 'override' }),
        { expiresIn: '5m' },
      );
    });
  });
});
