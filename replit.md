# Rebel Chefs - Fraternity Menu Management System

## Overview

Rebel Chefs is a full-stack web application designed for managing fraternity house meal menus. It allows chefs to create weekly menus with nutritional information, fraternity members to view menus and submit requests (late plates, substitutions, suggestions), and administrators to oversee chefs and approve menus. The system incorporates a role-based access control for users, chefs, house directors, and administrators, each with tailored permissions and dashboard functionalities. The project aims to streamline fraternity meal planning, enhance communication between members and kitchen staff, and provide detailed nutritional insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with shadcn/ui
- **Animations**: Framer Motion
- **Build Tool**: Vite
- **Structure**: Feature-based, with role-specific dashboards, shared UI components, custom hooks for data fetching, and protected routes with role-based access control.
- **UI/UX**: Mobile-responsive design across all dashboards, PWA support for installability, consolidated chef dashboard view, email-style interface for chef inbox.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **Authentication**: Passport.js with local strategy and session-based authentication using `connect-pg-simple` for production readiness.
- **Password Hashing**: Node.js crypto (scrypt)
- **Architecture**: Layered, separating API routes, data access (repository pattern), authentication logic, and database connection.

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation.
- **Schema**: Defined in `shared/schema.ts`, shared between frontend and backend.
- **Key Entities**: Users (roles: user, chef, house_director, admin), Menus (weekly with nutritional details), Menu Items (with main protein and sides), Feedback (user ratings, meal-specific), Requests (late plates, substitutions, suggestions), Menu Critiques (house director feedback with chef/admin acknowledgment), Chef Tasks (admin-assigned tasks for chefs).

### Core Features & Technical Implementations
- **Role-Based Access Control**: Four distinct roles with specific dashboards and permissions.
- **Menu Management**: Chefs create, edit, and publish weekly menus. Admins approve/manage menus.
- **Nutritional Information**: Menus include detailed macro-nutritional data for each item, with AI-powered estimation for chefs.
- **User Requests**: Members can submit late plate requests (with cutoff time validation and specific meal selection), substitution requests, and menu suggestions.
- **Notifications**:
    - **Browser Notifications**: Web Notifications API for in-app alerts on status changes (substitution, menu approval), new menus, and pending items.
    - **SMS Notifications**: Twilio integration for automatic SMS alerts to chefs regarding late plate cutoffs and new substitution/suggestion requests.
- **House Director Role**: View menus, submit critiques, export menus to PDF, with chef/admin acknowledgment workflow for critiques.
- **Admin Management**: Comprehensive tools for managing users, chefs (including profile management, task assignment, deletion), menus, and viewing all feedback and requests.
- **PDF Export**: Client-side generation of weekly menus to PDF, including nutritional details.
- **"Remember Me" Login**: Persists user email for convenience.
- **API Design**: RESTful endpoints, Zod schemas for validation, type-safe contracts.

## External Dependencies

### Database
- **PostgreSQL**: Main database.
- **Drizzle Kit**: For database migrations.

### Authentication
- **express-session**: Session management.
- **passport**, **passport-local**: Authentication framework.

### UI/UX
- **Radix UI**: Headless component primitives.
- **shadcn/ui**: Component library.
- **Lucide React**: Icon library.

### Development & Build Tools
- **Vite**: Frontend development server.
- **esbuild**: Backend bundling.
- **TSX**: TypeScript execution in development.

### AI Integration
- **OpenAI via Replit AI Integrations**: For automatic macro/nutrition estimation using `gpt-4o-mini`.

### Communication
- **Twilio**: For SMS notifications.