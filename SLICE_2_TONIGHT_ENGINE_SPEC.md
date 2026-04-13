# Slice 2 Spec — Tonight Engine v1

## Mission
Make Pourfolio immediately useful at the moment of decision.

Tonight Engine v1 must answer one premium question better than any wine app in the category:

**What should I open tonight?**

This cannot feel like a generic recommendation list. It must feel like a private sommelier making a context-aware decision from the bottles you already own.

## Why this slice goes second
Bottle Brain made the bottle intelligent.
Tonight Engine makes the cellar useful in the moment.

Together, these two slices create the first truly magical loop:
- understand a bottle deeply
- choose the right bottle for the moment

That is the beginning of a category-defining product.

## Current repo truth
There is already a recommendation surface:
- `src/app/(dashboard)/recommendations/page.tsx`
- `src/app/api/recommendations/route.ts`

But it is currently oriented around:
- AI-generated external wine recommendations
- taste-profile-style suggestions
- wines to buy or discover

That is not the Tonight Engine.

## Key decision
**Do not use the current recommendations page as the final Tonight Engine concept.**

We may reuse pieces, but the Tonight Engine must be repositioned around:
- bottles already in the cellar
- the current moment
- one best recommendation + alternates
- immediate opening confidence

## User promise
When I’m about to open wine, Pourfolio should help me decide with speed, confidence, and delight.

## Product doctrine
Tonight Engine must feel:
- decisive, not chatty
- context-aware, not generic
- intimate, not algorithmic
- premium, not gimmicky
- based on my real cellar, not only market suggestions

## Inputs for v1
Tonight Engine v1 should support lightweight context inputs.

### Required inputs
- meal type
- occasion
- mood
- adventurous vs safe

### Optional inputs
- companions
- budget sensitivity
- whether user wants to learn vs relax

## Outputs for v1
The page should produce:
1. **Best bottle now**
2. **Two alternates**
3. **Why each fits**
4. **Confidence state**
5. **What to watch out for**

## Core recommendation model for v1
This should be deterministic and transparent before becoming overly AI-driven.

### Candidate scoring inputs
- inventory status must be `in_cellar`
- wine type
- quantity remaining
- prior ratings on same bottle or similar wines
- taste-profile hints from ratings
- occasion tags if present
- drink window if present
- bottle uniqueness / scarcity
- whether the bottle is already opened
- value and premium-ness when known

### Context matching signals
- meal type to wine type/style match
- occasion to perceived bottle weight / prestige
- adventurous vs safe using prior tasting confidence and familiarity
- mood to body/acidity/intensity style if enough data exists

### Version 1 principle
The system should prefer a smart transparent heuristic over fake AI mystery.

## UX structure

### 1. Hero
Headline should be something like:
- Tonight Engine
- What should I open tonight?

Subhead:
- Calm, premium guidance from your actual cellar.

### 2. Context bar
Input controls for:
- meal
- occasion
- mood
- adventurous vs safe

Should feel fast, not form-heavy.

### 3. Best bottle now
Large featured recommendation with:
- bottle identity
- why it fits
- confidence
- open-now recommendation
- quick actions:
  - view bottle brain
  - open this bottle
  - choose an alternate

### 4. Alternates
Two additional options with slightly different tradeoffs.

### 5. Why tonight’s picks make sense
Short explanatory rail:
- safe choice
- interesting choice
- special occasion choice

### 6. Fallback state
If the cellar is sparse or data is weak:
- still recommend from what exists
- explain uncertainty honestly
- ask for the one missing thing that would improve the next recommendation

## Relationship to Bottle Brain
Tonight Engine must integrate directly with Bottle Brain.

For each recommendation:
- clicking it should go to `/cellar/[id]`
- recommendation summaries should leverage Bottle Brain fields later
- the best bottle should feel like a decision layer on top of Bottle Brain, not a separate product

## Live-data reality this slice must respect
Current cellar data includes:
- custom bottles with no `wine_reference_id`
- malformed vintages in some records
- sparse drink-window data
- sparse but real tasting history
- some market values, mostly incomplete

Therefore Tonight Engine v1 must:
- work well for custom-only bottles
- not require drink windows to function
- use ratings when available, but degrade cleanly when absent
- avoid overclaiming precision

## Recommended implementation direction

### Route decision
Most likely reuse and transform:
- `src/app/(dashboard)/recommendations/page.tsx`

But reposition it from generic recommendation marketplace toward cellar-first Tonight Engine.

### API decision
Current route:
- `src/app/api/recommendations/route.ts`

This route should likely be split conceptually into:
- Tonight recommendations from owned cellar
- later discovery / external recommendation flows

For v1, create a cellar-first Tonight engine contract.

## Suggested implementation components
- `TonightContextBar`
- `TonightPrimaryRecommendationCard`
- `TonightAlternateCard`
- `TonightConfidenceBadge`
- `TonightWhyThisWorksCard`

## Recommended scoring categories for v1
- readiness score
- taste match score
- occasion fit score
- confidence score

These can be collapsed into one display confidence if needed.

## Definition of done
Tonight Engine v1 is done when:
- the page recommends bottles from the user’s actual cellar
- there is one primary bottle and two alternates
- the user can provide lightweight context
- the result feels specific to the evening, not generic
- the explanation is clear and premium
- it works against the current live seeded data without pretending the data is richer than it is

## Immediate next build steps
1. Re-scope `recommendations/page.tsx` from discovery to Tonight Engine.
2. Replace or supplement current API logic with cellar-first recommendation logic.
3. Build context input bar.
4. Ship one best bottle + two alternates.
5. Link every result to Bottle Brain.

## Final standard
When Tonight Engine v1 ships, Brian should be able to say:
"This doesn’t just recommend wine. It helps me choose the right bottle for tonight from my real cellar with actual confidence."
