# Custom Picture Frame Order Management System

## Overview

This application is an end-to-end order management system for CustomPictureFrames.com. It facilitates the creation of detailed custom frame orders, including customer information, precise frame specifications, material selection, and automated pricing. The system supports various framing options like multiple mat configurations, special finishes, and calculates pricing based on materials, dimensions, and dynamic business rules. The ambition is to streamline the order process, enhance accuracy, and provide tools for managing pricing configurations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
-   **Framework**: React 18 with TypeScript and Vite.
-   **Components**: Radix UI primitives wrapped with shadcn/ui ("new-york" style) for accessible and consistent styling via Tailwind CSS.
-   **Routing**: Wouter for client-side routing, including unified order creation (`/`), order list (`/orders`), individual order detail (`/order/:id`), and password-protected control panel (`/control-panel`).
-   **State Management**: TanStack Query for server state management.
-   **Form Handling**: React Hook Form with Zod for type-safe validation.
-   **Unified Order Form**: Single form at `/` supports both single and multi-item orders with "Add Another Item" workflow - users fill out one item, click to add more, edit/remove accumulated items, then submit all at once. Form intelligently routes to `/api/orders` (single) or `/api/multi-orders` (multiple) based on pending items count.
-   **Styling**: Tailwind CSS with custom design tokens, supporting light/dark themes, following Material Design principles with a professional blue color palette (HSL 210 85% 45%).
-   **Typography**: Inter font for UI, JetBrains Mono for monospace content.

### Technical Implementations
-   **Backend**: Node.js with Express.js for RESTful JSON API.
-   **Business Logic**: Server-side pricing engine (`server/pricing.ts`) calculating costs based on Excel-derived formulas, dynamic markup, material upgrades, add-on services, mat configurations, tiered shipping, and sales tax.
-   **Data Validation**: Shared Zod schemas between frontend and backend for consistent validation.
-   **Monorepo Structure**: `client/`, `server/`, and `shared/` directories.
-   **Component Library Strategy**: shadcn/ui components copied into the project for full customization.
-   **Multi-Item Order System**: Normalized database schema with `order_headers` and `order_items` tables, supporting orders with multiple frames or components through the unified order form's "Add Another Item" workflow.
-   **Stacker Frames (Deep Shadowbox)**: Custom-depth shadowbox system with dynamic algorithm for optimal layer combination, specific pricing, and BOM generation. Vendor pricing: 70% discount on materials (SKU 9531 @ $2.616/ft, SKU 9532 @ $3.543/ft, SKU 9533 @ $2.508/ft, SKU 9731 @ $2.700/ft), assembly charge $12.50 per frame. Uses global tiered markup system (same as regular frames).
-   **Simplified Two-Tier Pricing**: System uses two simple markup rates: Full Frame orders (Frame + Acrylic + Backing + optional Mats) get 4.5× markup, all other Component orders (frame only, acrylic only, partial combinations) get 5.5× markup. This incentivizes customers to order complete frames. Fixed-cost add-ons (LEDs, plaques, shadowbox fitting, additional labor) pass through at retail price with no markup (1×). Per-square-inch add-ons (print services, canvas) receive the same markup treatment as materials.
-   **Itemized Component Pricing**: Expanded pricing result to include detailed breakdown of individual component costs in the order summary.
-   **Form Flexibility**: All form fields are optional, and mat fields support fraction/decimal inputs. Autocomplete (combobox) inputs for mat SKUs with clear button functionality - users can easily remove selected mats by clicking the X icon that appears when a value is selected.
-   **Pricing Configuration**: All add-on service pricing (print paper, dry mount, canvas printing/stretching, engraved plaques, LEDs, shadowbox fitting, additional labor) is configurable through the control panel. Per-square-inch services get markup treatment, fixed-cost services are retail prices. Minimum price floor of $29 applies to orders with frames. Simplified from complex tiered system on October 27, 2025.

### System Design Choices
-   **Server-Side Pricing**: All pricing calculations are performed on the server to ensure business logic integrity and prevent client manipulation.
-   **Excel-Based Pricing Data**: Pricing data from `ANNIE CPF Order Entry Sheet (1)_1761234370780.xlsx` is loaded into in-memory storage at server startup for rapid lookup.
-   **Dynamic Pricing Configuration**: A password-protected control panel allows staff to adjust business levers (markup, shipping rates, material pricing) without code changes.
-   **Margin Analysis System**: Comprehensive margin calculator validates pricing strategy against business metrics (marketing costs, labor, overhead allocation). Built-in scenario testing analyzes profitability across order types with configurable labor cost model and validation guardrails.
-   **Authentication**: No global authentication; internal users are assumed. Control panel is password-protected with SHA-256 hashing.

### Data Storage Solutions
-   **Database**: PostgreSQL via Drizzle ORM with Neon serverless driver.
-   **Schema**: `orders` table (legacy single-item orders) and new `order_headers`/`order_items` tables (multi-item orders) for comprehensive data storage.
-   **ORM**: Drizzle ORM for type-safe database queries.
-   **In-Memory Storage**: `MemStorage` for development/testing and `PricingConfigStorage` for dynamic pricing configuration.

## External Dependencies

-   **Database Service**: Neon serverless PostgreSQL.
-   **Email Service**: Resend API for transactional email delivery (order notifications, customer confirmations).
-   **Fonts**: Google Fonts (Inter, Geist Mono, Fira Code, DM Sans, Architects Daughter).
-   **Build Tools**: Vite (frontend), esbuild (production server), Drizzle Kit (migrations).
-   **Node.js Libraries**: Express.js, React, TypeScript, Radix UI, shadcn/ui, Tailwind CSS, Wouter, TanStack Query, React Hook Form, Zod, Drizzle ORM, `@neondatabase/serverless`, Resend, Stripe (ready for integration).

## Recent Changes

### October 27, 2025 - Email Integration & Order Recording Automation
-   **Transactional Email System**: Integrated Resend API for professional email delivery:
    -   Backend endpoint `/api/send-order-email` handles email sending with order details
    -   "Email Brian" button sends order details to brian@custompictureframes.com
    -   "Email Customer" button sends order confirmation to customer email address
    -   Replaces mailto: links with direct email sending through app
    -   Provides success/error toast notifications for email delivery status
    -   Uses environment secret RESEND_API_KEY for authentication
-   **Automatic Order Recording**: Streamlined order creation workflow:
    -   Removed "Record Order" button from order detail page (no longer needed)
    -   Orders are automatically recorded in the database when created
    -   Order creation confirmation now shows "Created & Recorded" message
    -   Eliminates redundant manual step in order workflow

### October 27, 2025 - Margin Analysis System
-   **Comprehensive Margin Calculator**: Built margin analysis tool to validate pricing strategy against real business metrics:
    -   Variable labor cost model based on frame size (small/medium/large) and complexity (mats, stacker assembly)
    -   Business metrics inputs: marketing % (25%), monthly overhead ($50K), frame volume (22K/month)
    -   Calculates gross margin, contribution margin after marketing/labor/overhead deductions
    -   6 predefined scenarios testing different order types (small frame, full frame, stacker, etc.)
    -   Health indicators: Green (>=20% margin), Yellow (15-20%), Red (<15%)
-   **Control Panel Integration**: Added "Margin Analysis" tab with:
    -   Configurable business metrics and labor cost inputs
    -   Visual scenario results with color-coded health status
    -   Detailed margin breakdown per scenario (retail, costs, deductions, net contribution)
-   **Validation Guardrails**: Frontend and backend validation prevents NaN/Infinity errors from invalid inputs
-   **Pricing Engine Enhancement**: Added `baseCosts` field to pricing result exposing pre-markup material costs for accurate margin calculations
-   **Analysis Results (User's Metrics)**: Average 36% margin across scenarios, 5/6 scenarios healthy (>=20%), validates current markup strategy (2.5×/4.5×/5.5×)