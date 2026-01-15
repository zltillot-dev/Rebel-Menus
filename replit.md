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
- Menu Items (individual meals with nutritional data including: description/main protein, side1, side2, side3, and macros)
- Feedback (user ratings and comments)
- Requests (late plates, substitutions, future requests)

## Recent Changes

### January 2026
- AI-powered macro estimation: Chefs can auto-estimate nutritional information (calories, protein, carbs, fats, sugar) using AI based on food item descriptions
- Users can now delete their own requests with confirmation dialog
- Fixed feedback API to allow users to view their own submitted feedback
- Fixed requests API to filter by user for privacy (users only see their own requests)
- Enhanced menu item schema: Added side1, side2, side3 fields to store sides/details separately from main protein
- Updated chef menu creation form: Now has 4 input fields per meal (Main Protein/Item, Side 1, Side 2, Side 3/Details)
- Updated MenuCard component: Displays sides as pills below the main item description
- Fixed session cookie configuration: Added proper cookie settings for reliable authentication

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

### AI Integration
- **OpenAI via Replit AI Integrations**: Used for automatic macro/nutrition estimation
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- Model: gpt-4o-mini for efficient JSON responses

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption (optional, has fallback)
- `AI_INTEGRATIONS_OPENAI_API_KEY`: Provided by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: Provided by Replit AI Integrations