import {getDb} from '../../core/db';
import {AuthEmailAlreadyExistsError} from './auth.errors';

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  locale: 'vi' | 'en';
  targetBand: number | null;
  createdAt: Date;
}

export interface NewAuthUser {
  email: string;
  passwordHash: string;
  displayName: string;
  locale: 'vi' | 'en';
  targetBand: number | null;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  create(input: NewAuthUser): Promise<AuthUser>;
  update(
    id: string,
    input: {
      displayName?: string;
      locale?: 'vi' | 'en';
      targetBand?: number | null;
      email?: string;
      passwordHash?: string;
    },
  ): Promise<AuthUser | null>;
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function mapPrismaUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  locale: string;
  targetBand: {toNumber(): number} | null;
  createdAt: Date;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    locale: user.locale as 'vi' | 'en',
    targetBand: user.targetBand?.toNumber() ?? null,
    createdAt: user.createdAt,
  };
}

export const prismaAuthRepository: AuthRepository = {
  async findByEmail(email) {
    const user = await getDb().user.findUnique({where: {email}});
    return user ? mapPrismaUser(user) : null;
  },
  async findById(id) {
    const user = await getDb().user.findUnique({where: {id}});
    return user ? mapPrismaUser(user) : null;
  },
  async create(input) {
    try {
      return mapPrismaUser(await getDb().user.create({data: input}));
    } catch (error) {
      if (hasPrismaCode(error, 'P2002')) throw new AuthEmailAlreadyExistsError();
      throw error;
    }
  },
  async update(id, input) {
    try {
      return mapPrismaUser(await getDb().user.update({where: {id}, data: input}));
    } catch (error) {
      if (hasPrismaCode(error, 'P2025')) return null;
      if (hasPrismaCode(error, 'P2002')) throw new AuthEmailAlreadyExistsError();
      throw error;
    }
  },
};
