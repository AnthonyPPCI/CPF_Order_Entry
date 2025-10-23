# Design Guidelines: Custom Picture Frame Order Management System

## Design Approach: Design System Foundation
**Selected System:** Material Design principles with modern SaaS application aesthetics
**Justification:** This is a utility-focused, information-dense business application requiring clear hierarchy, excellent form usability, and professional invoice presentation. Material Design provides the structure needed for complex forms while maintaining visual clarity.

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Primary: 210 85% 45% (Professional blue - trust and reliability)
- Primary Hover: 210 85% 38%
- Secondary: 210 15% 25% (Charcoal gray for text)
- Background: 0 0% 98% (Soft white)
- Surface: 0 0% 100% (Pure white for cards/forms)
- Border: 210 15% 88%
- Success: 142 70% 45% (For completed orders)
- Warning: 38 90% 55% (For pending/deposit status)

**Dark Mode:**
- Primary: 210 85% 55%
- Primary Hover: 210 85% 62%
- Secondary: 210 15% 85%
- Background: 220 15% 10%
- Surface: 220 15% 14%
- Border: 210 15% 22%
- Success: 142 70% 50%
- Warning: 38 90% 60%

### B. Typography

**Font Families:**
- Primary: 'Inter' (Google Fonts) - Clean, professional sans-serif for UI
- Monospace: 'JetBrains Mono' - For SKU codes, prices, invoice numbers

**Scale:**
- Display: 2.5rem/3rem, font-weight 700 (Page titles)
- H1: 2rem/2.5rem, font-weight 600 (Section headers)
- H2: 1.5rem/2rem, font-weight 600 (Card headers)
- H3: 1.25rem/1.75rem, font-weight 600 (Form section headers)
- Body: 1rem/1.5rem, font-weight 400 (Form labels, content)
- Small: 0.875rem/1.25rem, font-weight 400 (Helper text, metadata)
- Caption: 0.75rem/1rem, font-weight 500 (Field hints, table captions)

### C. Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Form field spacing: gap-4, mb-6
- Section padding: p-6 to p-8
- Card padding: p-6
- Page margins: px-4 md:px-8 lg:px-12

**Grid Structure:**
- Main container: max-w-7xl mx-auto
- Form layouts: grid-cols-1 md:grid-cols-2 gap-6
- Order list: Full width with responsive table/cards

### D. Component Library

**Navigation Header:**
- Fixed top bar with company logo (left) and contact info (right)
- Height: h-16
- Background: Surface color with bottom border
- Contains: "CustomPictureFrames.com" branding, phone number, email
- Navigation tabs: "New Order" | "Order List" with active state indicator

**Form Components:**
- Input fields: Rounded corners (rounded-lg), consistent height (h-12), clear focus states with primary color ring
- Labels: Bold font-weight-600, mb-2, small text-sm
- Dropdown selects: Styled consistently with inputs, chevron icon
- Checkboxes/Radio: Material Design style with primary color when checked
- Text areas: Min height h-24 for special requests
- Field groups: Related fields grouped in bordered containers with subtle background

**Customer Information Card:**
- White/surface background, rounded-lg, shadow-sm
- Grid layout: 2 columns on desktop, stacked on mobile
- Fields: Customer Name, Address 1, Address 2, City/State/Zip, Phone, Email
- Clear visual separation from frame configuration section

**Frame Configuration Section:**
- Organized into logical sub-sections with H3 headers:
  - Frame Basics (SKU, Width, Height, Chop Only)
  - Mat Configuration (Border inputs, SKU fields, reveal values)
  - Materials (Acrylic type, Backing type)
  - Additional Options (Print, Engraving, LEDs, etc.)
- Each sub-section in a bordered card with subtle background tint
- Conditional fields: Show/hide based on selections (e.g., mat reveal only if mat SKU selected)

**Pricing Display Panel:**
- Sticky sidebar on desktop (lg:sticky lg:top-20)
- Card with prominent total display
- Breakdown sections:
  - Item Total (large font-size, font-weight-700)
  - Shipping (with HI/AK/PR indicator)
  - Sales Tax
  - Discount (percentage display)
  - Final Total (emphasized with primary color, text-2xl)
- Real-time updates as form changes
- Clear "Create Order" CTA button at bottom

**Invoice/Order Summary View:**
- Professional layout matching spreadsheet structure
- Header: Company info (address, phone, email) - right-aligned
- Customer info block - left-aligned
- Order details table:
  - Alternating row backgrounds for readability
  - Clear column headers with proper alignment
  - Monospace font for prices and SKUs
- Summary section at bottom with totals clearly displayed
- Action buttons: "Download PDF" | "Edit Order" | "Print"

**Order List View:**
- Table on desktop, cards on mobile
- Columns: Order Date, Customer Name, Description, Total, Status, Actions
- Search/filter bar at top
- Status badges: Color-coded (Success green for paid, Warning yellow for deposit)
- Row hover states with subtle background change
- Click row to view full order details

**Buttons:**
- Primary CTA: bg-primary, rounded-lg, px-6, py-3, font-medium, hover:bg-primary-hover
- Secondary: border-2 border-primary, text-primary, same dimensions
- Icon buttons: Square (h-10 w-10) for actions in tables

**Data Tables:**
- Striped rows for better readability
- Fixed header on scroll
- Responsive: Stack as cards on mobile with key info visible
- Action column always visible (Edit, View, Delete icons)

### E. Animations

**Minimal, Purposeful Animations:**
- Form field focus: Smooth ring transition (transition-all duration-200)
- Button hover: Slight background color shift (transition-colors duration-150)
- Dropdown expand: Subtle slide-down (transition-transform duration-200)
- Page transitions: None - instant navigation for productivity
- Price updates: Brief highlight flash when values change (animate-pulse once)

## Page-Specific Layouts

**New Order Page:**
- Two-column layout on desktop: Form (2/3 width) + Pricing sidebar (1/3 width)
- Single column on mobile with pricing summary sticky at bottom
- Clear progress indication through form sections
- Validation messages inline with fields (text-red-600, text-sm)

**Order List Page:**
- Full-width data table with pagination
- Filter/search bar with date range picker
- Export to CSV button in top-right
- Empty state: Centered message with "Create First Order" CTA

**Order Detail/Invoice Page:**
- Centered max-w-4xl container
- Print-optimized layout with @media print styles
- Header with company branding
- Customer and order info in structured grid
- Itemized breakdown table
- Footer with payment terms and contact info

## Accessibility & UX

- All form fields have associated labels with htmlFor
- Required fields marked with asterisk and aria-required
- Error states: Red border, error icon, descriptive message
- Keyboard navigation: Tab order follows logical form flow
- Focus indicators: Clear, high-contrast rings
- Dark mode toggle in header navigation
- Loading states: Skeleton screens for order list, spinner for form submission
- Success notifications: Toast messages in top-right (4-second auto-dismiss)

## Professional Polish

- Consistent 8px baseline grid for all spacing
- Subtle shadows for depth (shadow-sm for cards, shadow-md for modals)
- Smooth transitions only where they enhance UX
- Professional color choices avoiding playful/consumer aesthetics
- Clear visual hierarchy: Size, weight, color, spacing all reinforce importance
- Invoice design matches business document standards