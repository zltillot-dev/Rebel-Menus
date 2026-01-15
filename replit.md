# Rebel Chefs - Fraternity Menu Management System

## Overview

This is a full-stack web application for managing fraternity house meal menus. The system enables chefs to create weekly menus with nutritional information, fraternity members to view menus and submit requests (late plates, substitutions), and administrators to manage chefs and approve menus.

The application uses a role-based access system with three user types: users (fraternity members), chefs, and admins. Each role has specific permissions and dashboard views.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with React plugin

The frontend follows a feature-based structure with:
- Role-specific dashboard pages (`/pages/user`, `/pages/admin`, `/pages/chef`)
- Shared UI components from shadcn/ui (`/components/ui`)
- Custom hooks for data fetching (`/hooks/use-auth.ts`, `/hooks/use-menus.ts`, etc.)
- Protected routes with role-based access control

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **Authentication**: Passport.js with local strategy, session-based auth
- **Password Hashing**: Node.js crypto (scrypt)
- **Session Storage**: Memory store (development), connect-pg-simple ready for production

The backend follows a layered architecture:
- `server/routes.ts`: API endpoint definitions
- `server/storage.ts`: Data access layer (repository pattern)
- `server/auth.ts`: Authentication configuration
- `server/db.ts`: Database connection

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)

Key entities:
- Users (with roles: user, chef, admin)
- Menus (weekly menus per fraternity)
- Menu Items (individual meals with nutritional data)
- Feedback (user ratings and comments)
- Requests (late plates, substitutions, future requests)

### API Design
- RESTful endpoints defined in `shared/routes.ts`
- Zod schemas for request/response validation
- Type-safe API contracts shared between client and server

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations (`npm run db:push`)

### Authentication
- **express-session**: Session management
- **passport**: Authentication middleware
- **passport-local**: Username/password authentication strategy

### UI Components
- **Radix UI**: Headless UI primitives (accordion, dialog, dropdown, etc.)
- **shadcn/ui**: Pre-styled component library built on Radix
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Development server with HMR
- **esbuild**: Production bundling for server
- **TSX**: TypeScript execution for development

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption (optional, has fallback)