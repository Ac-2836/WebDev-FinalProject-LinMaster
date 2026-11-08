import {createModuleRegistry} from '../core/module-registry';
import {healthModule} from '../core/health.route';

const registry = createModuleRegistry();

// Register each API module once here.
registry.register(healthModule);

export const apiModules = registry.getAll();
