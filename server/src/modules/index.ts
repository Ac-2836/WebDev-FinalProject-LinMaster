import {createModuleRegistry} from '../core/module-registry';
import {healthModule} from '../core/health.route';
import {createAuthModule} from './auth';
import {createExamModule} from './exam';
import {createFlashcardModule} from './flashcard';
import {createVocabModule} from './vocab';

export function createApiModules(jwtSecret: string) {
  const registry = createModuleRegistry();

  // Register each API module once here.
  registry.register(healthModule);
  registry.register(createAuthModule(jwtSecret));
  registry.register(createVocabModule(jwtSecret));
  registry.register(createFlashcardModule(jwtSecret));
  registry.register(createExamModule(jwtSecret));

  return registry.getAll();
}
