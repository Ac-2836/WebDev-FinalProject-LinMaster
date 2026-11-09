import {OpenAPIRegistry, OpenApiGeneratorV31} from '@asteasolutions/zod-to-openapi';

export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'LinMaster API',
      version: '1.0.0',
      description: 'API documentation for LinMaster.',
    },
    servers: [{url: '/'}],
    tags: [
      {name: 'Core', description: 'Health and core infrastructure.'},
      {name: 'Auth', description: 'Account registration, login, and profile management.'},
      {name: 'Vocab', description: 'Personal vocabulary entries and reading contexts.'},
      {name: 'Documents', description: 'Reading document upload, extraction, and personal document management.'},
      {name: 'Flashcard', description: 'Personal flashcard sets and cards.'},
    ],
  });
}
