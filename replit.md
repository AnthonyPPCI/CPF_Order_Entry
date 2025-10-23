# Custom Picture Frame Order Management System

## Overview

This application is an end-to-end order management system for CustomPictureFrames.com. It facilitates the creation of detailed custom frame orders, including customer information, precise frame specifications, material selection, and automated pricing. The system supports various framing options like multiple mat configurations, special finishes, and calculates pricing based on materials, dimensions, and dynamic business rules. The ambition is to streamline the order process, enhance accuracy, and provide tools for managing pricing configurations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
-   **Framework**: React 18 with TypeScript and Vite.
-   **Components**: Radix UI primitives wrapped with shadcn/ui ("new-york" style) for accessible and consistent styling via Tailwind CSS.
-   **Routing**: Wouter for client-side routing, including single-item order creation (`/`), multi-item order creation (`/new-multi-order`), order list (`/orders`), individual order detail (`/order/:id`), and password-protected control panel (`/control-panel`).
-   **State Management**: TanStack Query for server state management.
-   **Form Handling**: React Hook Form with Zod for type-safe validation.
-   **Styling**: Tailwind CSS with custom design tokens, supporting light/dark themes, following Material Design principles with a professional blue color palette (HSL 210 85% 45%).
-   **Typography**: Inter font for UI, JetBrains Mono for monospace content.

### Technical Implementations
-   **Backend**: Node.js with Express.js for RESTful JSON API.
-   **Business Logic**: Server-side pricing engine (`server/pricing.ts`) calculating costs based on Excel-derived formulas, dynamic markup, material upgrades, add-on services, mat configurations, tiered shipping, and sales tax.
-   **Data Validation**: Shared Zod schemas between frontend and backend for consistent validation.
-   **Monorepo Structure**: `client/`, `server/`, and `shared/` directories.
-   **Component Library Strategy**: shadcn/ui components copied into the project for full customization.
-   **Multi-Item Order System**: Normalized database schema with `order_headers` and `order_items` tables, supporting orders with multiple frames or components, and a dedicated multi-item order creation form.
-   **Stacker Frames (Deep Shadowbox)**: Custom-depth shadowbox system with dynamic algorithm for optimal layer combination, specific pricing, and BOM generation.
-   **Differential Markup**: Implemented 3.0× markup for standalone components (acrylic, backing, mats) when not ordered with a frame.
-   **Itemized Component Pricing**: Expanded pricing result to include detailed breakdown of individual component costs in the order summary.
-   **Form Flexibility**: All form fields are optional, and mat fields support fraction/decimal inputs. Autocomplete (combobox) inputs for mat SKUs.

### System Design Choices
-   **Server-Side Pricing**: All pricing calculations are performed on the server to ensure business logic integrity and prevent client manipulation.
-   **Excel-Based Pricing Data**: Pricing data from `ANNIE CPF Order Entry Sheet (1)_1761234370780.xlsx` is loaded into in-memory storage at server startup for rapid lookup.
-   **Dynamic Pricing Configuration**: A password-protected control panel allows staff to adjust business levers (markup, shipping rates, material pricing) without code changes.
-   **Authentication**: No global authentication; internal users are assumed. Control panel is password-protected with SHA-256 hashing.

### Data Storage Solutions
-   **Database**: PostgreSQL via Drizzle ORM with Neon serverless driver.
-   **Schema**: `orders` table (legacy single-item orders) and new `order_headers`/`order_items` tables (multi-item orders) for comprehensive data storage.
-   **ORM**: Drizzle ORM for type-safe database queries.
-   **In-Memory Storage**: `MemStorage` for development/testing and `PricingConfigStorage` for dynamic pricing configuration.

## External Dependencies

-   **Database Service**: Neon serverless PostgreSQL.
-   **Fonts**: Google Fonts (Inter, Geist Mono, Fira Code, DM Sans, Architects Daughter).
-   **Build Tools**: Vite (frontend), esbuild (production server), Drizzle Kit (migrations).
-   **Node.js Libraries**: Express.js, React, TypeScript, Radix UI, shadcn/ui, Tailwind CSS, Wouter, TanStack Query, React Hook Form, Zod, Drizzle ORM, `@neondatabase/serverless`.