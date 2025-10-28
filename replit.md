# Custom Picture Frame Order Management System

## Overview
This application is an end-to-end order management system for CustomPictureFrames.com. It streamlines the creation of custom frame orders, managing customer information, precise frame specifications, material selection, and automated pricing. The system supports diverse framing options, including multiple mat configurations and special finishes. Its core purpose is to enhance accuracy, streamline the order process, and provide tools for managing dynamic pricing configurations. The business vision is to improve operational efficiency and profitability in the custom picture frame market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
-   **Framework**: React 18 with TypeScript and Vite.
-   **Components**: Radix UI primitives wrapped with shadcn/ui for accessible styling via Tailwind CSS.
-   **Routing**: Wouter for client-side routing, supporting order creation (`/`), order list (`/orders`), individual order detail (`/order/:id`), and a control panel (`/control-panel`).
-   **State Management**: TanStack Query for server state.
-   **Form Handling**: React Hook Form with Zod for type-safe validation.
-   **Unified Order Form**: A single form at `/` handles both single and multi-item orders.
-   **Styling**: Tailwind CSS with custom design tokens, supporting light/dark themes, using a professional blue color palette (HSL 210 85% 45%).
-   **Typography**: Inter font for UI, JetBrains Mono for monospace content.

### Technical Implementations
-   **Backend**: Node.js with Express.js for a RESTful JSON API.
-   **Business Logic**: Server-side pricing engine calculates costs based on Excel-derived formulas, dynamic markup, material upgrades, add-on services, mat configurations, tiered shipping, and sales tax.
-   **Data Validation**: Shared Zod schemas between frontend and backend.
-   **Monorepo Structure**: Organized into `client/`, `server/`, and `shared/` directories.
-   **Multi-Item Order System**: Supports orders with multiple frames or components via `order_headers` and `order_items` tables.
-   **Stacker Frames**: Custom-depth shadowbox system with a dynamic algorithm for optimal layer combination and specific pricing.
-   **Simplified Two-Tier Pricing**: Uses two simple markup rates: 4.5× for Full Frame orders and 5.5× for Component orders, incentivizing complete frame purchases.
-   **Itemized Component Pricing**: Provides a detailed breakdown of individual component costs in the order summary.
-   **Form Flexibility**: All form fields are optional, mat fields support fraction/decimal inputs, and autocomplete inputs have clear button functionality.
-   **Pricing Configuration**: All add-on service pricing is configurable through the control panel. A minimum price floor of $29 applies to orders with frames.
-   **Sample Order Implementation**: Allows ordering frame/mat samples with $0 item cost and delivery-method-aware shipping.
-   **Stale Payment Prevention**: Multi-layered system to prevent stale payment data, including auto-clearing on amount/method changes and submit-time validation.

### System Design Choices
-   **Server-Side Pricing**: All pricing calculations are performed on the server.
-   **Excel-Based Pricing Data**: Pricing data from a master Excel sheet is loaded into in-memory storage at server startup.
-   **Dynamic Pricing Configuration**: A password-protected control panel allows staff to adjust business levers without code changes.
-   **Margin Analysis System**: Comprehensive margin calculator validates pricing strategy, built-in scenario testing, and configurable labor cost model.
-   **Authentication**: Control panel is password-protected with SHA-256 hashing.
-   **Square Payment Integration**: Backend integration with Square SDK for processing credit card payments and automatic order balance updates.
-   **Transactional Email System**: Integrated Resend API for sending order notifications and customer confirmations.
-   **Automatic Order Recording**: Orders are automatically recorded in the database upon creation.
-   **ShipStation Integration**: Fully integrated ShipStation V1 REST API for automatic order syncing, including optional sync, data mapping, and non-blocking synchronization.
-   **Google Reviews Request System**: Prominent button on new order form and order detail page sends frictionless review requests via email (Resend) or SMS (optional Twilio), directing customers to Google Reviews page.
-   **PayPal Invoice Integration**: Fully integrated PayPal Invoicing API v2 for sending payment invoices to customers, with automatic payment tracking via webhooks and real-time order balance updates.

### Data Storage Solutions
-   **Database**: PostgreSQL via Drizzle ORM with Neon serverless driver.
-   **Schema**: `orders` table (legacy single-item) and `order_headers`/`order_items` tables (multi-item).
-   **ORM**: Drizzle ORM for type-safe database queries.
-   **In-Memory Storage**: `MemStorage` and `PricingConfigStorage` for development/testing and dynamic pricing configuration.

## External Dependencies

-   **Database Service**: Neon serverless PostgreSQL.
-   **Email Service**: Resend API.
-   **SMS Service**: Twilio API (optional for Google Reviews SMS).
-   **Payment Gateways**: Square SDK for credit card processing, PayPal Invoicing API v2 for invoice-based payments.
-   **Shipping Integration**: ShipStation V1 REST API.
-   **Fonts**: Google Fonts (Inter, Geist Mono, Fira Code, DM Sans, Architects Daughter).
-   **Build Tools**: Vite (frontend), esbuild (production server), Drizzle Kit (migrations).
-   **Node.js Libraries**: Express.js, React, TypeScript, Radix UI, shadcn/ui, Tailwind CSS, Wouter, TanStack Query, React Hook Form, Zod, Drizzle ORM, `@neondatabase/serverless`.