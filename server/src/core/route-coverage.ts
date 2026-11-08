import type {generateOpenApiDocument} from './openapi-registry';
import type {ApiModule} from './module-registry';

export interface ApiRoute {
  method: string;
  path: string;
}

interface ExpressRouteLayer {
  route?: {
    path: string | string[];
    methods: Record<string, boolean>;
  };
  handle?: {
    stack?: unknown[];
  };
}

type OpenApiDocument = ReturnType<typeof generateOpenApiDocument>;

function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function joinPaths(basePath: string, routePath: string): string {
  return `/${[basePath, routePath]
    .map(part => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')}`;
}

export function listApiRoutes(modules: ApiModule[]): ApiRoute[] {
  return modules.flatMap(module =>
    module.router.stack.flatMap(layer => {
      const expressLayer = layer as ExpressRouteLayer;
      if (!expressLayer.route && Array.isArray(expressLayer.handle?.stack)) {
        throw new Error('Nested routers are not supported; register API routes directly on the module router.');
      }

      const route = expressLayer.route;
      if (!route) return [];

      const paths = Array.isArray(route.path) ? route.path : [route.path];
      const methods = Object.entries(route.methods)
        .filter(([method, enabled]) => enabled && method !== 'head')
        .map(([method]) => method.toLowerCase());

      return paths.flatMap(path =>
        methods.map(method => ({
          method,
          path: toOpenApiPath(joinPaths(module.basePath, path)),
        })),
      );
    }),
  );
}

export function findUndocumentedRoutes(modules: ApiModule[], document: OpenApiDocument): ApiRoute[] {
  const documentedPaths = document.paths ?? {};

  return listApiRoutes(modules).filter(({method, path}) => {
    const operations = documentedPaths[path];
    return !operations || !(method in operations);
  });
}
