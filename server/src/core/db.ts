import {PrismaPg} from '@prisma/adapter-pg';

import {PrismaClient} from '../generated/prisma/client';
import {getEnv} from './config/env';

let client: PrismaClient | undefined;

/** The single Prisma client of the server. Modules reach the database only through it (Project_Structure 4.2). */
export function getDb(): PrismaClient {
  client ??= new PrismaClient({adapter: new PrismaPg({connectionString: getEnv().DATABASE_URL})});
  return client;
}
