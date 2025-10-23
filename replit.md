# Custom Picture Frame Order Management System

## Overview

This is a business management application for CustomPictureFrames.com, a custom picture framing company based in Somerset, NJ. The system handles end-to-end order management including customer information, frame specifications, material selection, pricing calculations, and order tracking. The application enables staff to create detailed custom frame orders with precise measurements, multiple mat configurations, special finishing options, and automated pricing based on materials and dimensions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript using Vite as the build tool and development server.

**UI Component System**: Radix UI primitives wrapped with shadcn/ui components following the "new-york" style variant. This provides accessible, customizable components with consistent styling through Tailwind CSS.

**Routing**: Wouter for client-side routing with three main routes:
- `/` - New order creation form
- `/orders` - Order list view with search functionality
- `/order/:id` - Individual order detail view

**State Management**: TanStack Query (React Query) for server state management with infinite stale time and disabled refetching, treating the backend as the single source of truth.

**Form Handling**: React Hook Form with Zod schema validation using `@hookform/resolvers` for type-safe form validation that mirrors backend schema validation.

**Styling System**: Tailwind CSS with custom design tokens supporting light/dark themes. Design follows Material Design principles optimized for information-dense business applications with professional color palette (blue primary at HSL 210 85% 45%).

**Typography**: Inter font family for UI elements and JetBrains Mono for monospace content (SKUs, prices, invoice numbers).

### Backend Architecture

**Runtime**: Node.js with Express.js server handling API routes and serving the static frontend.

**API Design**: RESTful JSON API with the following endpoints:
- `GET /api/orders` - Retrieve all orders sorted by date
- `GET /api/orders/:id` - Retrieve single order
- `POST /api/orders` - Create new order with server-side pricing calculation
- `PUT /api/orders/:id` - Update existing order
- `DELETE /api/orders/:id` - Delete order

**Business Logic**: Server-side pricing calculation engine (`server/pricing.ts`) that computes costs based on:
- Frame perimeter ($0.50 per inch base rate)
- Material upgrades (acrylic type, backing type)
- Add-on services (printing, dry mounting, engraving, LEDs, etc.)
- Mat configurations and additional openings
- Quantity discounts
- Regional shipping rates (standard vs. HI/AK/PR)
- Sales tax calculation (7% for NJ addresses)

**Data Validation**: Shared Zod schemas between frontend and backend ensure consistent validation. Schema defined in `shared/schema.ts` and used for both TypeScript types and runtime validation.

**Development Mode**: Vite middleware integration for HMR (Hot Module Replacement) during development with custom error overlays and logging.

### Data Storage Solutions

**Database**: PostgreSQL configured through Drizzle ORM with the Neon serverless driver (`@neondatabase/serverless`).

**Schema Design**: Single `orders` table with comprehensive fields covering:
- Customer information (name, address, contact details)
- Frame specifications (SKU, dimensions, chop-only flag)
- Mat configuration (up to 3 mats with individual borders and reveals)
- Material selections (acrylic type, backing type)
- Service options (printing, mounting, engraving, etc.)
- Pricing fields (item total, shipping, tax, total, balance)
- Payment tracking (deposit, payment status)
- Timestamps (order date)

**ORM Layer**: Drizzle ORM provides type-safe database queries with schema-first approach. Migrations stored in `/migrations` directory.

**In-Memory Storage**: `MemStorage` class provides development/testing storage without database dependency. Implements `IStorage` interface for easy swapping between storage backends.

### Authentication and Authorization

**Current Implementation**: No authentication system implemented. Application assumes trusted internal users on secure network.

**Session Management**: Express session infrastructure present (`connect-pg-simple` for PostgreSQL session storage) but not actively used.

### External Dependencies

**Database Service**: Configured for Neon serverless PostgreSQL via environment variable `DATABASE_URL`. Application fails fast if database URL is not provided.

**Google Fonts**: CDN-hosted fonts (Inter, Geist Mono, Fira Code, DM Sans, Architects Daughter) loaded from Google Fonts for typography.

**Build Tools**: 
- Vite for frontend bundling and development server
- esbuild for production server bundling
- Drizzle Kit for database migrations

**Type Safety**: Full TypeScript coverage with strict mode enabled and path aliases configured (`@/` for client, `@shared/` for shared code).

**Development Utilities** (Replit-specific):
- Runtime error modal overlay
- Cartographer for code navigation
- Development banner

**Notable Architecture Decisions**:

1. **Shared Schema Pattern**: Business logic schemas defined once in `shared/schema.ts` and used by both client (for form validation) and server (for API validation), eliminating duplication and ensuring consistency.

2. **Server-Side Pricing**: All pricing calculations performed server-side to maintain business logic integrity and prevent client manipulation.

3. **Monorepo Structure**: Frontend (`client/`), backend (`server/`), and shared code (`shared/`) in single repository with unified TypeScript configuration.

4. **Component Library Strategy**: Using shadcn/ui pattern of copying components into project rather than npm dependency, allowing full customization while maintaining consistency.

5. **No Build Step for Development**: Vite serves TypeScript directly during development with middleware mode integration into Express server.