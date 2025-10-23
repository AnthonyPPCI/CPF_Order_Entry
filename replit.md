# Custom Picture Frame Order Management System

## Overview

This is a business management application for CustomPictureFrames.com, a custom picture framing company based in Somerset, NJ. The system handles end-to-end order management including customer information, frame specifications, material selection, pricing calculations, and order tracking. The application enables staff to create detailed custom frame orders with precise measurements, multiple mat configurations, special finishing options, and automated pricing based on materials and dimensions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript using Vite as the build tool and development server.

**UI Component System**: Radix UI primitives wrapped with shadcn/ui components following the "new-york" style variant. This provides accessible, customizable components with consistent styling through Tailwind CSS.

**Routing**: Wouter for client-side routing with four main routes:
- `/` - New order creation form with real-time pricing preview
- `/orders` - Order list view with search functionality
- `/order/:id` - Individual order detail view
- `/control-panel` - Password-protected pricing configuration management

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
- `POST /api/pricing` - Calculate pricing preview without creating order (debounced from frontend)
- `POST /api/control-panel/verify` - Verify control panel password
- `GET /api/control-panel/config` - Retrieve pricing configuration
- `POST /api/control-panel/config` - Update pricing configuration (password required)

**Business Logic**: Server-side pricing calculation engine (`server/pricing.ts`) that computes costs based on:
- Exact Google Sheets formulas using real moulding/supply data from Excel file (2,216 mouldings, 1,781 supplies)
- Frame cost = Join Cost × Join Feet (calculated from united inches and moulding width)
- Dynamic markup multiplier (default 2.75×, configurable via control panel)
- Material upgrades with per-square-inch pricing (acrylic: $0.009-$0.027/sq in, backing: $2-$3 flat)
- Add-on services (printing, dry mounting, engraving, LEDs, etc.)
- Mat configurations (up to 3 mats) and additional openings ($2.50 each)
- Tiered shipping rates based on united inches (configurable: $9-$250)
- Remote destination surcharge (+$99 for HI/AK/PR when under 75 united inches)
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

**Pricing Data Storage**: Excel-based pricing data loaded at server startup from `attached_assets/ANNIE CPF Order Entry Sheet (1)_1761234370780.xlsx` containing:
- 2,216 moulding SKUs with join costs and dimensions
- 1,781 supply items with pricing
- Loaded into in-memory maps for fast lookup during pricing calculations

**Pricing Configuration Storage**: `PricingConfigStorage` class maintains dynamic pricing configuration in memory:
- Markup multiplier (default: 2.75×)
- Chop-only join feet (default: 18 feet)
- Shipping rate tiers based on united inches
- Acrylic pricing per square inch (Standard/Non-Glare/Museum Quality)
- Backing pricing (None/White Foam/Black Foam/Acid Free)
- Password protection with SHA-256 hashing (password: 2026DOG)

### Authentication and Authorization

**Current Implementation**: No global authentication system. Application assumes trusted internal users on secure network.

**Control Panel Security**: Password-protected pricing configuration management using SHA-256 hashing:
- Password: "2026DOG" (hash stored in memory)
- Required for all configuration updates
- Password verification via `/api/control-panel/verify` endpoint
- No session management - password required per operation

**Session Management**: Express session infrastructure present (`connect-pg-simple` for PostgreSQL session storage) but not actively used for order management.

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

2. **Server-Side Pricing**: All pricing calculations performed server-side to maintain business logic integrity and prevent client manipulation. Frontend receives pricing via debounced API calls (500ms delay) for real-time preview.

3. **Excel-Based Pricing Data**: Pricing data loaded from Excel file at server startup into in-memory storage for fast lookup, matching the original Google Sheets workflow exactly.

4. **Dynamic Pricing Configuration**: Business levers (markup, shipping rates, material pricing) stored in configurable in-memory storage accessible via password-protected control panel, allowing staff to adjust pricing without code changes.

5. **Monorepo Structure**: Frontend (`client/`), backend (`server/`), and shared code (`shared/`) in single repository with unified TypeScript configuration.

6. **Component Library Strategy**: Using shadcn/ui pattern of copying components into project rather than npm dependency, allowing full customization while maintaining consistency.

7. **No Build Step for Development**: Vite serves TypeScript directly during development with middleware mode integration into Express server.

## Recent Changes (October 23, 2025)

**Form Flexibility & Mat Selection Enhancement:**
- Made all form fields optional - orders can be saved with any combination of filled fields
- Implemented autocomplete (combobox) inputs for mat SKUs with intelligent search
  - Search by either SKU or supply name
  - Shows SKU, name, and price in dropdown
  - Filters through all 1,781 supply items
  - Limits display to 100 results for performance
- Mat pricing correctly pulls from Supply tab using `getSupply()` function
- Updated control panel to display all Excel columns for mouldings (9 cols) and supplies (4 cols)
- Changed discount, deposit, mat reveal 1, and mat reveal 2 to text boxes for flexible input
  - Allows freeform text like "10%", "$50", "0.125", etc.
  - Updated database schema: discount, deposit, mat_1_reveal, mat_2_reveal are now text fields
- Updated "Extra Mat Openings" label to clarify "(after the first opening)"

**Pricing System Enhancement:**
- Implemented exact Google Sheets formulas using real moulding/supply data from Excel file
- Added real-time pricing preview with debounced API calls (500ms) in order creation form
- Built password-protected control panel for editing pricing configuration
- Added dynamic pricing levers: markup multiplier, shipping rates, acrylic/backing prices
- Validated pricing accuracy: SKU 8694 (20×60") calculates to $105.74 with 2.75× markup, $115.35 with 3.00× markup
- Configuration changes take effect immediately across all pricing calculations