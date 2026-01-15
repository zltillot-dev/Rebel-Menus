import { z } from 'zod';
import { 
  insertUserSchema, insertMenuSchema, insertMenuItemSchema, insertFeedbackSchema, insertRequestSchema, 
  users, menus, menuItems, feedback, requests,
  type InsertMenu, type InsertMenuItem, type InsertFeedback, type InsertRequest
} from './schema';

export * from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        username: z.string(), // email
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  menus: {
    list: {
      method: 'GET' as const,
      path: '/api/menus',
      input: z.object({
        fraternity: z.string().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof menus.$inferSelect & { items: typeof menuItems.$inferSelect[] }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/menus/:id',
      responses: {
        200: z.custom<typeof menus.$inferSelect & { items: typeof menuItems.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/menus',
      input: insertMenuSchema.extend({
        items: z.array(insertMenuItemSchema.omit({ menuId: true }))
      }),
      responses: {
        201: z.custom<typeof menus.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/menus/:id/status',
      input: z.object({ status: z.string() }),
      responses: {
        200: z.custom<typeof menus.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/menus/:id',
      input: insertMenuSchema.extend({
        items: z.array(insertMenuItemSchema.omit({ menuId: true }))
      }),
      responses: {
        200: z.custom<typeof menus.$inferSelect & { items: typeof menuItems.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/menus/:id',
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },
  feedback: {
    create: {
      method: 'POST' as const,
      path: '/api/feedback',
      input: insertFeedbackSchema,
      responses: {
        201: z.custom<typeof feedback.$inferSelect>(),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/feedback',
      responses: {
        200: z.array(z.custom<typeof feedback.$inferSelect>()),
      },
    },
  },
  requests: {
    create: {
      method: 'POST' as const,
      path: '/api/requests',
      input: insertRequestSchema,
      responses: {
        201: z.custom<typeof requests.$inferSelect>(),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/requests',
      responses: {
        200: z.array(z.custom<typeof requests.$inferSelect & { user: typeof users.$inferSelect }>()),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/requests/:id',
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },
  admin: {
    createChef: {
      method: 'POST' as const,
      path: '/api/admin/chefs',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
      },
    },
    listChefs: {
      method: 'GET' as const,
      path: '/api/admin/chefs',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
