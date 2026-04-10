/**
 * OpenAPI/Swagger Configuration
 *
 * API documentation for Agent Hub REST API
 * Generated with swagger-jsdoc
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Agent Hub API',
      version: '1.0.0',
      description:
        'Multi-agent collaboration platform API for realistic group conversations with relationship-aware AI agents',
      contact: {
        name: 'Agent Hub Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'https://api.agent-hub.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for admin endpoints',
        },
      },
      schemas: {
        Room: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['family', 'work', 'social'] },
            description: { type: 'string', nullable: true },
            context: { type: 'string', nullable: true },
            settings: { type: 'object', nullable: true },
            externalChatId: { type: 'string', nullable: true },
            sessionMaxAge: { type: 'integer', default: 3600 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'type'],
        },
        Agent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            roomId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            role: { type: 'string' },
            avatar: { type: 'string' },
            talkativeness: { type: 'integer', minimum: 0, maximum: 10 },
            empathy: { type: 'integer', minimum: 0, maximum: 10 },
            curiosity: { type: 'integer', minimum: 0, maximum: 10 },
            isActive: { type: 'boolean', default: true },
            sessionId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'roomId', 'name', 'role'],
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            roomId: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            senderType: { type: 'string', enum: ['human', 'agent'] },
            agentId: { type: 'string', nullable: true },
            discussionId: { type: 'string', nullable: true },
            metadata: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            agentName: { type: 'string', nullable: true },
            agentAvatar: { type: 'string', nullable: true },
          },
          required: ['id', 'roomId', 'content', 'senderType'],
        },
        Discussion: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            roomId: { type: 'string', format: 'uuid' },
            topic: { type: 'string' },
            status: { type: 'string', enum: ['active', 'warming', 'cooling', 'archived'] },
            heatScore: { type: 'integer', minimum: 0, maximum: 100 },
            lastActivityAt: { type: 'string', format: 'date-time' },
            archivedAt: { type: 'string', format: 'date-time', nullable: true },
            metadata: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'roomId', 'topic', 'status', 'heatScore'],
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object', nullable: true },
                timestamp: { type: 'string', format: 'date-time' },
                path: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const specs = swaggerJsdoc(options);
