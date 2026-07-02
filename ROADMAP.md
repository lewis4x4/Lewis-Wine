# Pourfolio Strategic Roadmap (historical)

> **Status note (2026-07-01):** This early roadmap is retained for history. The
> canonical, current roadmap is
> [`docs/roadmaps/pourfolio-intelligence-os-roadmap.md`](docs/roadmaps/pourfolio-intelligence-os-roadmap.md).
> Checkboxes below have been reconciled against the actual codebase.

## 1. Executive Summary
**Vision**: Create the world's most capable, "enterprise-grade" personal wine management system.
**Current State**: Strong architectural foundation (Next.js 16, Supabase, Tailwind). Advanced data model implemented. Key features (cellar, scan, analytics) in various stages of maturity.
**Immediate Goal**: Polish core workflows, ensure data integrity, and launch "Power User" features.

## 2. Technical Review

### Strengths
- **Architecture**: Modern, scalable stack (Next.js App Router, React 19, Supabase).
- **Data Model**: Highly detailed schema supporting "Enterprise" complexity (drinking windows, extensive tasting notes, sub-locations, financials).
- **UI/UX**: Clean aesthetic using Shadcn UI and specialized components (Barcode Scanner).

### Areas for Improvement
- **Routing & Onboarding**: Need to clarify the "Logged In" entry point. (Is it `/cellar` or a Dashboard Overview?).
- **Scanning Intelligence**: Barcode scanning is basic. "Enterprise" tier requires OCR (Label Scanning) and Receipt parsing.
- **Data Portability**: No obvious bulk import/export tools found yet.
- **Testing**: Need to ensure rigorous E2E testing for the "Consumer Grade" reliability.

## 3. Product Roadmap

### Phase 1: Foundation Clean-up (Week 1-2)
- [x] **Home View**: Establish a dedicated Dashboard Home summarizing Cellar Value, Ready to Drink, and Recent Activity. (`src/app/(dashboard)/page.tsx`)
- [x] **Data Integrity**: Implement robust form validation for adding wines (Zod schemas). (zod at the boundary in newer API routes)
- [ ] **Navigation Polish**: Ensure mobile/desktop navigation is seamless. (mobile/tablet nav gaps remain — see deep-dive review)

### Phase 2: The "Power" Features (Week 3-4)
- [x] **Intelligent Scanning**:
    - Label OCR shipped via Claude vision (`/api/label/scan`, `/scan/label`, `/capture`).
    - Receipt scanning shipped (`/api/receipt/scan`, `/scan/receipt`).
- [x] **Analytics Deep Dive**: `/analytics` ships value, distribution, and varietal views. (value-over-time still needs a snapshot writer)
- [ ] **Bulk Operations**:
    - [ ] Multi-select delete/move.
    - [x] CSV Import/Export (Settings → Data Tools; CellarTracker importer via script/API).
- [x] **Physical Asset Tagging**: QR codes on bottle detail.

### Phase 3: "Enterprise" Grade (Month 2+)
- [ ] **Guest Menu Mode**: "iPad View" for guests—hide prices, show stories.
- [x] **Blind Tasting Game**: Shipped at `/blind-tasting` (linked from the More menu).
- [x] **Sommelier AI**: Tonight Engine, Bottle Brain, Restaurant/Shopping Mode, Portfolio Radar.
- [ ] **Market Data**: Evidence-based valuations exist; no external pricing API integration yet.
- [x] **Social & Sharing**: `/social` friends + shared tastings (feature-flagged maturity).

## 4. Immediate Next Steps
See the canonical roadmap and `docs/reviews/2026-07-01-deep-dive-review.md` for the current ranked plan.
