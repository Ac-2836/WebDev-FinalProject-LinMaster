import type {Router} from 'express';

export interface ApiModule {
  name: string;
  basePath: string;
  router: Router;
}

export function createModuleRegistry() {
  const modules = new Map<string, ApiModule>();

  return {
    register(module: ApiModule): void {
      if (modules.has(module.name)) {
        throw new Error(`API module "${module.name}" is already registered.`);
      }

      modules.set(module.name, module);
    },

    getAll(): ApiModule[] {
      return [...modules.values()];
    },
  };
}
