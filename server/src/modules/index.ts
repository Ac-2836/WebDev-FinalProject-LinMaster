import {createModuleRegistry} from '../core/module-registry';
import {healthModule} from '../core/health.route';
import {authModule} from './auth';

const registry = createModuleRegistry();

// Register each API module once here.
registry.register(healthModule);
registry.register(authModule);

export const apiModules = registry.getAll();
