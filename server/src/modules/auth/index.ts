import type {ApiModule} from '../../core/module-registry';
import {prismaAuthRepository} from './auth.repository';
import type {AuthRepository} from './auth.repository';
import {createAuthRouter} from './auth.routes';
import {createAuthService} from './auth.service';
import './auth.openapi';

export function createAuthModule(jwtSecret: string, repository: AuthRepository = prismaAuthRepository): ApiModule {
  const service = createAuthService(repository, jwtSecret);
  return {name: 'auth', basePath: '/api/v1', router: createAuthRouter(service, jwtSecret)};
}

export {createAuthService, DUMMY_PASSWORD_HASH} from './auth.service';
export type {AuthCrypto} from './auth.service';
export type {AuthRepository, AuthUser} from './auth.repository';

/** Public API for the stats module: the band the user aims for, or null. */
export async function getTargetBand(userId: string): Promise<number | null> {
  return (await prismaAuthRepository.findById(userId))?.targetBand ?? null;
}
