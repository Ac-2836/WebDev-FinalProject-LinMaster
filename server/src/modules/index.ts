import {createModuleRegistry} from '../core/module-registry';
import {healthModule} from '../core/health.route';
import {createAuthModule} from './auth';

export function createApiModules(jwtSecret: string) {
  const registry = createModuleRegistry();

  // Register each API module once here.
  registry.register(healthModule);
  registry.register(createAuthModule(jwtSecret));

  return registry.getAll();
}
