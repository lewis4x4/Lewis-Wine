# Pourfolio Strategic Roadmap

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
- [ ] **Home View**: Establish a dedicated Dashboard Home (`/dashboard`) summarizing Cellar Value, Ready to Drink, and Recent Activity.
- [ ] **Data Integrity**: Implement robust form validation for adding wines (Zod schemas).
- [ ] **Navigation Polish**: Ensure mobile/desktop navigation is seamless.

### Phase 2: The "Power" Features (Week 3-4)
- [ ] **Intelligent Scanning**: 
    - Implement Label OCR (Google Vision or similar).
    - Implement Receipt Scanning for bulk imports.
- [ ] **Analytics Deep Dive**:
    - Visualize "Cellar Value over Time".
    - "Drink by Year" distribution.
    - Varietal breakdowns.
- [ ] **Bulk Operations**:
    - Multi-select delete/move.
    - CSV Import/Export.
- [ ] **Physical Asset Tagging**: Generate printable QR codes for bottle necks.

### Phase 3: "Enterprise" Grade (Month 2+)
- [ ] **Guest Menu Mode**: "iPad View" for guests—hide prices, show stories.
- [ ] **Blind Tasting Game**: Gamified education using your own inventory.
- [ ] **Sommelier AI**: LLM-integrated recommendations based on cellar contents + drinking windows.
- [ ] **Market Data**: Integration with wine pricing APIs (WineSearcher/Liv-ex) to auto-update bottle values.
- [ ] **Social & Sharing**: Shareable wine lists.

## 4. Immediate Next Steps
1. Create the **Dashboard Home** (`src/app/(dashboard)/page.tsx`) to serve as the command center.
2. Verify the **Scanner** flow with real-world scenarios.
3. Review **Analytics** implementation to ensure it leverages the rich data model.
