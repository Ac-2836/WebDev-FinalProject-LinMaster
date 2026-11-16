import {createModuleRegistry} from '../core/module-registry';
import {healthModule} from '../core/health.route';
import {createAuthModule} from './auth';
import {createExamModule} from './exam';
import {createFlashcardModule} from './flashcard';
import {createLibraryModule} from './library';
import {createStatsModule} from './stats';
import {createVocabModule} from './vocab';

/** `registrationsPerHour`: only the Playwright API raises it (see `AppOptions`). */
export function createApiModules(jwtSecret: string, {registrationsPerHour}: {registrationsPerHour?: number} = {}) {
  const registry = createModuleRegistry();

  // Register each API module once here.
  registry.register(healthModule);
  registry.register(createAuthModule(jwtSecret, undefined, registrationsPerHour));
  registry.register(createVocabModule(jwtSecret));
  registry.register(createFlashcardModule(jwtSecret));
  registry.register(createExamModule(jwtSecret));
  registry.register(createStatsModule(jwtSecret));
  registry.register(createLibraryModule(jwtSecret));

  return registry.getAll();
}
