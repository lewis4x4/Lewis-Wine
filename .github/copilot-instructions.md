# Copilot Instructions for Lewis-Wine (Pourfolio)

## Project Overview

**Pourfolio** is a Next.js 16 wine portfolio management app that helps users track, rate, and manage their wine collections. It features barcode scanning, tasting notes, portfolio valuation, and cellar inventory management.

**Tech Stack**: Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL) · TanStack Query · Tailwind CSS · Zod · React Hook Form

## Architecture Overview

### Data Flow & Service Boundaries

1. **Frontend Components** (React 19, "use client") → **Custom Hooks** (TanStack Query) → **Supabase Client** → **PostgreSQL**
2. **API Routes** (Next.js Route Handlers) use **server-side Supabase clients** with admin keys for elevated operations (wine search, cross-user queries)
3. **Authentication**: Supabase Auth (JWT) via `AuthProvider` context + `useAuth()` hook

### Key Domain Models

- **`wine_reference`**: Immutable wine catalog (searchable via full-text index on `search_vector`). Populated from LWIN database via seed script.
- **`cellar_inventory`**: User's wine stock with status tracking (`in_cellar`, `consumed`). Relationships: wine_reference, ratings, locations.
- **`ratings`**: Tasting experiences with structured notes (appearance, nose, palate, characteristics, aromas, food pairings).
- **`cellar_locations`**: Hierarchical storage locations (e.g., "Rack A - Shelf 1") supporting both simple (string) and complex (JSONB) modes.
- **`market_value`**: Portfolio valuation tracking. Supports multiple sources; glass count conversions from bottle quantities.

### Component Organization

```
src/components/
├── ui/              # Shadcn UI primitives (button, card, dialog, etc.)
├── layout/          # Global layout (header, mobile-nav)
├── providers/       # QueryProvider, AuthProvider (context + hooks)
├── wine/            # Wine-specific: wine-card, rating-input, barcode-scanner
├── tasting/         # Tasting form compound components (aroma-selector, food-pairing-input, etc.)
├── cellar/          # Cellar features: alerts-dashboard, location-selector
└── financial/       # Portfolio: portfolio-dashboard, market-value-editor, price-per-glass
```

### Hook Patterns (src/lib/hooks/)

**Query Hooks** (read-only, TanStack Query):
- `useCellar()`, `useCellarInventory()`: Fetch cellar data with nested relations
- `useWineSearch(query)`: Full-text search via API route
- `useCellarValue()`, `useValueByType()`, `useValueByRegion()`: Portfolio aggregations

**Mutation Hooks** (write operations, with optimistic invalidation):
- `useAddToInventory()`, `useUpdateInventory()`, `useConsumeWine()`
- `useAddRating()`: Saves rating + associated food_pairings in transaction-like pattern
- `useUpdateMarketValue()`, `useTrackGlasses()`

**Pattern**: Mutations call `queryClient.invalidateQueries()` on success to refresh related queries (e.g., adding rating invalidates both `cellar-inventory` and `wine-detail`).

## Critical Developer Workflows

### Development

```bash
npm run dev          # Start Next.js dev server on http://localhost:3000
npm run build        # Production build (required before `npm start`)
npm start            # Run production build locally
npm run lint         # Run ESLint (flat config)
npm run db:seed      # Populate wine_reference table from CSV via Supabase
```

### Database

Migrations in `supabase/migrations/`:
1. `00001_initial_schema.sql`: Profiles, wine_reference, cellars, cellar_inventory
2. `00002_cellar_management.sql`: Locations, low-stock alerts, drink window tracking
3. `00003_tasting_experience.sql`: Ratings, food_pairings, characteristics, aromas
4. `00004_financial_tracking.sql`: Market values, portfolio calculations

To test migrations locally: `supabase start` (requires Docker + Supabase CLI). To sync Supabase remote: `supabase db push`.

### Environment Setup

Required `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

Optional (for admin operations):
```
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

## Project-Specific Patterns & Conventions

### Type Safety & Database Schema

- **Generated types** in `src/types/database.ts` from Supabase schema. Always regenerate after migrations: `supabase gen types typescript > src/types/database.ts`
- **Insert/Update types** separate from Row types (e.g., `CellarInventoryInsert` vs `CellarInventory`) to enforce required fields
- **Zod schemas** for form validation (in respective components)

### Client vs. Server Components

- **Client** (`"use client"`): Query hooks, auth context, interactive forms, state management
- **Server**: API routes, middleware (auth redirects), metadata/viewport exports
- **Middleware** in `src/middleware.ts`: Auth protection for `/dashboard/*` routes

### Form & Validation Patterns

- Use **React Hook Form** + **Zod** for schema validation (examples: `EnhancedTastingForm`, wine search inputs)
- Compound components pattern: Break complex forms into smaller components (e.g., `AromaSelector`, `FoodPairingInput`) that manage own state but report back via callback

### Search Pattern

- **API route** (`/api/wines/search`): Accepts `?q=query`
  - Primary: Full-text search on `wine_reference.search_vector` (PostgreSQL tsvector)
  - Fallback: Case-insensitive ILIKE on name/producer if FTS fails
  - Returns max 20 results transformed to `WineSearchResult` shape
- **Hook** `useWineSearch(query)`: Client-side wrapping with TanStack Query caching

### Portfolio Valuation Pattern

- **Market values** stored separately in `market_value` table (not mutated in inventory updates)
- **Aggregation queries**: `useCellarValue()` groups by status; `useValueByType()` / `useValueByRegion()` enable analytics
- **Glass tracking**: `useTrackGlasses()` converts bottle quantities → pour sizes (relevant for price-per-glass calculations)

### Notification & Alerts

- **Toasts**: Use `sonner` (Toaster component in root layout, imported in components)
- **Low-stock/drink-window alerts**: Computed via `useLowStockWines()` and `useDrinkingWindowWines()` hooks, displayed in dashboard

### Styling & Theming

- **Tailwind CSS v4** (via `@tailwindcss/postcss`) with custom theme colors (wine red `#722F37`)
- **Fonts**: Inter (body), Playfair Display (headings) via next/font
- **Dark mode**: Configured via `next-themes` (theme preference in user settings)

## Integration Points & External Dependencies

### Supabase Integration

- **Client**: `createClient()` from `src/lib/supabase/client.ts` (browser-safe, uses anon key)
- **Server**: Direct `createClient()` with `SERVICE_ROLE_KEY` in API routes for admin queries
- **Auth state**: Synced via `onAuthStateChange()` listener in `AuthProvider` (context for all client components)

### Wine Data Sources

- **Primary**: Seeded from LWIN (wine barcode ID) CSV in `archive/`; script: `scripts/seed-wines.ts`
- **Enrichment**: Critic scores (Vivino) stored in `wine_reference.critic_scores` JSONB
- **Barcode scanning**: `html5-qrcode` library in `barcode-scanner.tsx` component

### PWA Setup

- **next-pwa** configured in `next.config.ts` (disabled in dev, enabled in prod)
- Manifest in `public/manifest.json`
- Allows offline access to cached pages/assets

## Conventions to Preserve

1. **Query key structure**: Follow TanStack Query patterns (e.g., `["cellar-inventory"]`, `["wine-detail", id]`) for predictable invalidation
2. **Component naming**: Plural for collections, singular for individual items; suffixes like `-form`, `-card`, `-selector` indicate role
3. **Hook naming**: `use[Noun]()` for queries, `use[Verb][Noun]()` for mutations (e.g., `useAddRating()`)
4. **Error handling**: Log to console, throw errors to bubble up to React Query (which handles UI display via `onError` callbacks)
5. **Path aliases**: Always use `@/` prefix (configured in `tsconfig.json` paths) for imports
6. **Disable ESLint warnings cautiously**: Use `// eslint-disable-next-line` only for known Supabase typing issues (marked in codebase)

## Quick Reference: File Locations

| Task | File |
|------|------|
| Add wine search UI | `src/components/wine/` |
| Add cellar feature | `src/lib/hooks/use-cellar*.ts` → `src/components/cellar/` |
| Add tasting form field | `src/components/tasting/*.tsx` → `use-ratings.ts` |
| Add API endpoint | `src/app/api/[feature]/route.ts` |
| Update auth logic | `src/components/providers/auth-provider.tsx` or `src/middleware.ts` |
| Adjust database | `supabase/migrations/` + regenerate types |
| Style customization | `src/app/globals.css` (Tailwind) or component className |
