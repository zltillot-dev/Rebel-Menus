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

#### Admin Chef Profile Management (Latest)
- Admins can now view detailed chef profiles from the admin dashboard
- View Chef dialog shows: name, fraternity, email, role, phone number, and assigned tasks count
- Admins can delete chef profiles with confirmation
- Deleting a chef also deletes all tasks assigned to that chef
- API endpoint: DELETE /api/admin/chefs/:id (admin only)
- Each chef card has eye icon (view) and trash icon (delete) buttons

#### Mark as Read for Inbox Items
- Chefs can now mark substitutions, meal suggestions, and feedback as read
- Each inbox item has a checkbox for toggling read/unread status
- API endpoints: PATCH /api/requests/:id/read and PATCH /api/feedback/:id/read
- Authorization: Chefs can only mark their own fraternity's items as read
- UI changes:
  - Unread count shown in solid badge, total count in outline badge when all read
  - Read items appear faded (opacity-60)
  - Items can be toggled back to unread by unchecking
- Schema updates: Added isRead boolean field to both `requests` and `feedback` tables

#### Chef Dashboard Redesign & Tasks System
- **Chef Tasks & Reminders**: New system for admin to assign tasks/reminders to chefs
  - `chef_tasks` table added with: title, description, priority (low/medium/high), isCompleted, dueDate
  - API endpoints: GET/POST /api/admin/chef-tasks (admin), GET /api/chef-tasks (chef), PATCH/DELETE
  - Admin can create, view, and delete tasks for any chef
  - Chefs can view and mark tasks as completed
- **Chef Dashboard Consolidated View**: 
  - Dashboard view (/chef) now shows: Current week's menu, Tasks & Reminders section, collapsible inbox sections (Late Plates, Substitutions, Meal Suggestions, Feedback)
  - Removed the left tab navigation in favor of consolidated dashboard
  - Inbox sections use collapsible cards for better organization
- **Manage Menus View** (/chef/menus):
  - Current week's menu with edit capability
  - Menus needing revision section at top (highlighted)
  - Future menus section
  - Past menus section
  - Create Menu button for new menus
- **Admin Tasks Management**:
  - New "Chef Tasks & Reminders" section in admin dashboard
  - Add Task dialog to assign tasks to specific chefs
  - View tasks grouped by chef with priority badges and due dates
  - Delete tasks with confirmation

#### Per-Meal Feedback & Admin Delete
- Users now rate specific meals (selecting day + meal type like "Monday Lunch") instead of rating entire days
- Feedback dialog requires selecting both mealDay and mealType before submitting
- Admin can delete ANY menu regardless of status (pending, approved, active) via "All Menus" tab
- Menu deletion cascades to delete associated feedback entries (prevents FK constraint violations)
- Admin dashboard now has "Pending" and "All Menus" tabs for better menu management
- Schema updated: feedback.mealDay and feedback.mealType are now required (NOT NULL)
- API validation added: feedback creation validates mealDay (Mon-Fri) and mealType (Lunch/Dinner)

#### Chef Dashboard Email-Style Interface
- Chef dashboard redesigned with left sidebar navigation tabs
- Tabs: Late Plates, Substitutions, Meal Suggestions, Feedback, Past Menus
- Content area updates based on selected tab (similar to email client layout)
- Added useChefFeedback hook and /api/chef-feedback endpoint for chef-specific feedback viewing

#### Menu Suggestions & Substitutions Separation
- User dashboard now has three distinct action buttons: "Late Plate", "Substitution", and "Menu Suggestion"
- Late Plate requests are separate from Substitutions (different icons, workflows)
- Menu Suggestions allow users to suggest dishes for future menus
- Both Substitutions and Menu Suggestions trigger instant SMS notifications to the chef
- SMS format includes: user name, email, timestamp, and details
- Chef dashboard displays a "Substitutions & Menu Suggestions" section with two cards
- Substitutions and menu suggestions are kept for 60 days, then automatically deleted
- Daily cleanup job runs to remove old entries (60+ days old)

#### Admin & Chef Account Management
- Updated admin credentials: chefzak@rebelchefs.net / Drum14me!!
- Admin can add new chefs from the Admin Dashboard with email/password/name/fraternity
- Chefs can update their profile (name, email, password) via "Account Settings" button in Chef Dashboard
- Profile updates require current password verification when changing password
- Branding updated: App now uses "REBEL CHEFS" text branding (removed logo images)

#### Late Plate Request Enhancements
- Added cutoff time validation: Lunch late plates must be submitted before 12:45 PM, dinner before 5:45 PM
- Wednesday dinners are NEVER available for late plate requests
- Users must select specific day and meal when requesting late plates (e.g., "Monday, January 19th - Lunch")
- Added mealDay, mealType, and fraternity fields to requests table schema
- Chef dashboard now displays late plate requests organized by meal service:
  - "Today's Late Plates" section for prominent display of current day's requests
  - "Late Plate Requests" section showing all requests grouped by meal
- Added /api/late-plates endpoint for chef-specific late plate fetching with user info
- Chefs only see late plates for their own fraternity

#### Twilio SMS Notifications
- Integrated Twilio via Replit Connectors for automatic SMS alerts to chefs
- Scheduler runs every 30 seconds checking for cutoff times (12:45 PM lunch, 5:45 PM dinner)
- At cutoff time, chefs with phone numbers receive SMS with formatted late plate list
- Chefs can update their phone number in the Chef Dashboard via "SMS Settings" button
- Added phoneNumber field to users table for SMS contact info
- Admin-only endpoint to manually trigger SMS for testing: POST /api/admin/trigger-late-plate-sms

#### Previous Changes
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