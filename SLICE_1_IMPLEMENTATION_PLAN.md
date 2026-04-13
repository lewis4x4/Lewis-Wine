# Slice 1 Implementation Plan — Bottle Brain v1

## Decision
Use the existing canonical route:
- `src/app/(dashboard)/cellar/[id]/page.tsx`

Do not create a competing route.
This route is already the natural Bottle Brain home because it is the current wine detail surface and already pulls the core live data we need.

## Existing strengths in current route
The current page already has meaningful raw material:
- canonical bottle route exists
- inventory + wine reference query exists
- tasting history exists
- photo gallery exists
- market value editor exists
- price per glass / opened-state logic exists
- storage location editing exists
- low stock settings exist
- consume / restore flows exist

This is good. We are not starting from zero.

## Current weaknesses
The current page is functional but not world-class.

### Product weaknesses
- reads like stacked utility cards, not one premium bottle intelligence surface
- no top operator brief
- no decisive recommendation state like drink/hold/gift/buy more
- no strong hero identity treatment
- memory/tasting is present but not elevated enough emotionally
- value is present but not framed as truth with confidence
- data-quality improvement prompts do not exist
- custom-bottle handling is functional but not celebrated

### UX weaknesses
- too linear and card-stacked
- details come before meaning
- not enough hierarchy or editorial feel
- no single "best next move"
- no explicit "what matters now"

## Canonical implementation direction
Transform the current detail route into Bottle Brain rather than replacing it.

## Build sequence

### Step 1: Create Bottle Brain view-model layer
Create a normalized mapper that turns mixed custom/reference data into one page contract.

Suggested file:
- `src/lib/bottle-brain/build-bottle-brain.ts`

Responsibilities:
- resolve display name, producer, region, vintage, wine type
- build operator brief strings
- calculate recommendation state
- derive location label
- derive value confidence state
- derive data-quality prompts
- derive memory summary

This must prevent UI logic from being scattered throughout the page.

### Step 2: Rebuild page top section as a hero + command surface
Replace current header and quick-info band with:
- hero identity rail
- operator brief cards
- next-action CTA cluster

New sections:
1. Bottle hero
2. What matters now
3. Best next move
4. Risk if ignored

### Step 3: Add readiness / recommendation rail
Introduce a clear recommendation surface.

Recommendation states for v1:
- Drink now
- Hold
- Revisit later
- Add value estimate
- Add first tasting note
- Improve bottle record

This can be rule-based for v1.

### Step 4: Upgrade tasting history into memory rail
Current tasting history is useful but still utility-oriented.

Upgrade goals:
- latest tasting should be highlighted as the current memory anchor
- prior tastings become a timeline
- emotional/context cues should be surfaced before the raw attribute list
- empty state should invite the first meaningful memory

### Step 5: Reframe financial components as Value Truth rail
Current components are useful, but the page needs one value story.

Wrap or reframe around:
- current value
- source
- confidence state
- last updated
- gain/loss if valid
- clear next action if unknown

### Step 6: Add Improve This Bottle module
New module should softly surface record issues such as:
- malformed vintage
- no market value
- no tasting notes
- no location
- no reference linkage
- missing drink window
- no photo

This should feel like premium guidance, not system nagging.

## Concrete page architecture target

### Section order
1. Bottle hero
2. Operator brief
3. Readiness / recommendation rail
4. Memory rail
5. Value truth rail
6. Provenance + acquisition rail
7. Photo rail
8. Improve this bottle rail
9. Utility controls like QR / low-stock / restore

## Route-level implementation notes
Current route file:
- `src/app/(dashboard)/cellar/[id]/page.tsx`

Current page should be refactored, not merely patched inline.

Recommended extraction targets:
- `src/components/bottle-brain/bottle-hero.tsx`
- `src/components/bottle-brain/bottle-operator-brief.tsx`
- `src/components/bottle-brain/bottle-readiness-card.tsx`
- `src/components/bottle-brain/bottle-memory-rail.tsx`
- `src/components/bottle-brain/bottle-value-truth-card.tsx`
- `src/components/bottle-brain/bottle-improvement-card.tsx`

## Existing code to reuse
- query and route shell in `src/app/(dashboard)/cellar/[id]/page.tsx`
- `PhotoGallery`
- `EnhancedTastingForm`
- `MarketValueEditor`
- `PricePerGlass`
- `QRCodeGenerator`
- low-stock settings logic
- consume/restore flows

## Existing code to de-emphasize or reposition
- current plain header
- current quick info badge strip
- generic details card placement
- current card order

## First implementation milestone
### Milestone A
Ship a transformed top half of the page only:
- hero identity
- operator brief
- readiness rail
- upgraded CTA cluster

Why first:
- fastest visible leap in quality
- defines the product language for the rest of the app
- low enough scope to ship cleanly

### Milestone B
Upgrade memory and value rails.

### Milestone C
Add Improve This Bottle and polish the full page architecture.

## Data rules for v1 recommendation logic
Initial recommendation should be deterministic and understandable.

Suggested decision priorities:
1. if no tasting exists -> recommend adding first tasting note
2. if market value missing and bottle seems premium -> recommend adding estimate
3. if drink window says ready -> recommend drink now
4. if bottle is opened -> recommend finish / track glasses
5. if data quality weak -> recommend improve record
6. otherwise -> hold / revisit later

## Success criteria for implementation discovery
This plan is successful if the team can now build Bottle Brain directly without reopening strategic ambiguity.

## Immediate next action
Proceed into Milestone A implementation on:
- `src/app/(dashboard)/cellar/[id]/page.tsx`
using a new Bottle Brain view-model and top-of-page component extraction.
