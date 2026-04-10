/**
 * API Documentation Routes
 *
 * Serves Swagger UI and OpenAPI specification
 */

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { specs } from '../config/swagger.js';

export const router = Router();

/**
 * Serve Swagger UI
 *
 * GET /api/docs
 * Interactive API documentation
 */
router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Agent Hub API Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

/**
 * Serve OpenAPI JSON spec
 *
 * GET /api/docs/json
 * Raw OpenAPI specification
 */
router.get('/json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

/**
 * Serve OpenAPI YAML spec
 *
 * GET /api/docs/yaml
 * Raw OpenAPI specification in YAML format
 */
router.get('/yaml', (_req, res) => {
  res.setHeader('Content-Type', 'application/x-yaml');
  res.send(specs);
});
