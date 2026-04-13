# Pourfolio Moonshot Roadmap

## Mission
Build the greatest wine app ever made: not a bottle tracker, not a social toy, not a notes app, but a world-class wine operating system that combines cellar intelligence, taste memory, moment recommendations, portfolio visibility, and emotional memory into one product.

## Product standard
Pourfolio must feel:
- more personal than Vivino
- more elegant than CellarTracker
- more useful than a spreadsheet
- more intelligent than a search box
- more emotionally resonant than a review log
- more decisive than a dashboard

This is not a feature race. This is a product-compression exercise toward one calm, intelligent, premium system.

## Ground truth from current repo + live project

### What already exists
- Next.js app with auth and dashboard shell
- Core cellar schema wired to Supabase
- Inventory, wine reference, ratings, photos, and market-value support
- Wishlist, shopping, winery visits, social, and planning surfaces scaffolded in schema
- Real live data exists now in:
  - `cellars`
  - `cellar_inventory`
  - `wine_reference`
  - `ratings`
  - `wine_photos`
  - `market_value_history`
  - `profiles`
  - `occasion_presets`
  - `aroma_reference`

### What is real product gravity today
The current gravity is:
1. bottle inventory
2. manual/custom wine entries
3. tasting notes and ratings
4. cellar photos
5. basic value tracking

### What is not yet the product center
These are present but not yet the real heart of usage:
- social graph
- shared tastings
- shopping workflows
- wishlist loop
- winery visits
- alerts automation
- portfolio snapshots as a habit loop

## Moonshot doctrine

### 1. Bottle Brain
Every bottle becomes a living intelligence object, not just a row.

Each bottle should answer:
- what is this?
- why do I own it?
- when should I drink it?
- what meal or moment fits it?
- how valuable is it?
- what did I think before?
- what should I do next?

### 2. Tonight Engine
The best bottle for the current moment should always be one tap away.

Inputs should include:
- meal
- people
- mood
- occasion
- weather/season
- budget sensitivity
- adventurous vs safe preference

Outputs should include:
- best bottle now
- two alternates
- why it fits
- confidence level

### 3. Taste Genome
Pourfolio should learn the user's palate better than the user can describe it.

It should model:
- preferred regions
- varietals/blends
- acidity/body/tannin/sweetness preferences
- producer affinity
- vintage patterns
- value sensitivity
- contextual shifts (steak night vs celebration vs solo)
- surprise wins and repeat disappointments

### 4. Cellar Command Center
The cellar should function like an intelligent operating board.

Core questions:
- what should I drink soon?
- what is at risk of being forgotten?
- what is peaking?
- what should I buy more of?
- what is underperforming relative to price?
- where is my collection unbalanced?
- which bottles have memory but no notes?

### 5. Memory Layer
The best wine experiences are stories, not entries.

Pourfolio should preserve:
- where you were
- who you were with
- what you ate
- what you felt
- whether the wine overdelivered or underdelivered
- how that experience changed your future taste

### 6. Portfolio Truth
Financial surfaces should be premium and honest, not fake precision.

Principles:
- distinguish market-known vs estimated vs unknown
- show confidence level, not false certainty
- track gain/loss honestly
- tie valuation to actual decision utility: hold, drink, gift, buy more

## North-star user experience
The app should eventually feel like:
- a private sommelier
- a memory vault
- a cellar Bloomberg terminal
- a taste coach
- a dinner decision engine

## Product architecture

### Layer A: Canonical entities
- User
- Cellar
- Bottle / Inventory item
- Wine reference
- Rating / tasting event
- Photo
- Purchase
- Market value event
- Occasion
- Companion
- Winery visit
- Recommendation

### Layer B: Intelligence services
- Taste profile builder
- Drinking-window evaluator
- Tonight recommendation engine
- Portfolio valuation engine
- Pairing engine
- Bottle next-action classifier
- Data-quality / record-linking engine

### Layer C: User-facing command surfaces
- Home / Command Center
- Bottle Brain page
- Tonight page
- Cellar page
- Taste Genome page
- Portfolio page
- Memory / Journal page
- Discovery / Buy-next page

## Build sequence philosophy
- Build the most magical core loop first
- Compress surfaces instead of multiplying them
- Every page must answer: what matters now, why it matters, what to do next
- No ornamental AI
- No fake market precision
- No dead-end notes pages

## Roadmap

## Slice 0: Foundation truth pass
### Goal
Establish product truth before feature acceleration.

### Deliverables
- verify every current route and core component against live schema
- document real working flows vs aspirational flows
- clean env/dev/runtime setup
- define seeded demo / canonical account state
- create product doctrine docs in repo

### Success criteria
- no uncertainty about current app shape
- no guessing about live backend surfaces
- one canonical roadmap in repo

## Slice 1: Bottle Brain v1
### Goal
Create one world-class bottle detail surface that becomes the quality bar for the entire app.

### User value
A bottle becomes an object with identity, memory, value, context, and a clear next action.

### Scope
- create or upgrade bottle detail page
- consolidate:
  - bottle identity
  - producer / region / style
  - quantity and location
  - purchase context
  - market value and confidence
  - tasting history
  - photos
  - “drink / hold / gift / buy more” recommendation
- support both linked reference wines and fully custom wines gracefully

### Key requirements
- custom inventory records must feel first-class, not second-rate
- empty states should actively guide the next useful action
- visual design should feel premium and editorial

### Success criteria
- one bottle page feels unmistakably better than category norms
- user can understand a bottle in under 10 seconds
- page provides at least one clear next action every time

## Slice 2: Tonight Engine v1
### Goal
Make Pourfolio immediately useful in the moment of decision.

### User value
Answer: what should I open tonight?

### Scope
- create a Tonight surface
- inputs:
  - meal type
  - occasion
  - companions
  - mood
  - adventurous vs safe
- outputs:
  - top recommendation
  - two alternates
  - why each matches
  - bottle readiness signal

### Logic version 1
- use current cellar inventory only
- weight by drink window, wine type, previous ratings, occasion tags, and bottle uniqueness
- fall back gracefully when structured data is sparse

### Success criteria
- recommendation feels specific, not generic
- user can choose a bottle with confidence in under a minute

## Slice 3: Command Center v1
### Goal
Turn the dashboard from summary cards into a true operating surface.

### User value
See exactly what deserves attention right now.

### Scope
- upgrade dashboard into command center
- top rails:
  - drink soon
  - unloved expensive bottles
  - missing market values
  - bottles without tasting notes
  - recent additions not yet reviewed
  - low-stock favorites
- replace vague metrics with action-oriented sections

### Success criteria
- opening the app gives a clear reason to act
- dashboard becomes decisive, not decorative

## Slice 4: Taste Genome v1
### Goal
Make taste learning visible and useful.

### User value
The app understands what I love, what I think I love, and what I actually reward.

### Scope
- derive taste profile from ratings and bottle metadata
- surface:
  - favorite regions
  - preferred wine structures
  - best-value pattern
  - recurring over/underperformers
  - style map
- include confidence flags based on sample size

### Success criteria
- user learns something true and non-obvious about their palate
- output changes future choices

## Slice 5: Portfolio Truth v1
### Goal
Make the financial layer feel serious and honest.

### User value
Know what the cellar is worth and where that number is solid vs fuzzy.

### Scope
- rebuild portfolio dashboard around valuation confidence
- show:
  - known value
  - estimated value
  - unknown value coverage gap
  - gain/loss
  - concentration by region/style/producer
- explain provenance of every number

### Success criteria
- value surfaces increase trust instead of reducing it
- user knows what to update next to improve accuracy

## Slice 6: Memory Layer v1
### Goal
Preserve wine experiences as meaningful memories, not detached scores.

### User value
Remember the best bottles, moments, people, and meals.

### Scope
- enrich tasting flow with:
  - who was there
  - what was eaten
  - where it happened
  - whether the wine surprised/disappointed
  - whether you’d buy/open again
- create a memory timeline

### Success criteria
- tasting notes become emotionally sticky and reviewable
- app starts to feel irreplaceable

## Slice 7: Data quality and record intelligence
### Goal
Make the collection cleaner and smarter over time.

### User value
Less messy data, better recommendations.

### Scope
- detect bad vintages, duplicate wines, malformed producers, inconsistent regions
- suggest merges / fixes
- improve custom-to-reference linking
- standardize wine typing where possible

### Success criteria
- data gets cleaner without feeling like admin work
- intelligence improves as records improve

## Slice 8: Buying intelligence
### Goal
Turn passive wishlists into proactive cellar strategy.

### User value
Know what to buy next and why.

### Scope
- build buy-next surface
- use taste profile + cellar gaps + low-stock patterns + price sensitivity
- classify suggestions:
  - replenish
  - diversify
  - special occasion
  - high-upside experiment

### Success criteria
- recommendations feel like a sommelier and portfolio advisor working together

## Slice 9: Winery and provenance layer
### Goal
Make winery experiences part of the lasting product loop.

### User value
Visits become a meaningful acquisition and memory source.

### Scope
- winery visit logging
- wines tasted vs purchased vs wishlisted
- link winery experiences to later ratings and purchases

### Success criteria
- winery visits deepen memory and buying intelligence

## Slice 10: Social, but only if premium
### Goal
Add sharing only where it increases meaning, not noise.

### User value
Share memorable tastings and trusted recommendations with selected people.

### Scope
- private/public tasting share controls
- close-circle recommendation sharing
- comments and reactions only if they add signal

### Success criteria
- social layer feels intimate and tasteful, never spammy

## Design doctrine
- premium, calm, intimate, editorial
- strong bottle imagery
- emotionally rich but never cheesy
- market and tasting data should look trustworthy
- no cluttered dashboards
- every page should feel like a sommelier desk, not an admin panel

## Technical doctrine
- keep Supabase as source of truth
- treat custom wines as first-class citizens
- avoid fake analytics when data is sparse
- prefer derived intelligence layers over hard-coded dashboards
- keep one canonical entity model per concept
- every slice should ship behind solid empty states and degraded modes

## Immediate execution plan
1. Read and map all current cellar, dashboard, tasting, and portfolio surfaces.
2. Define the canonical Bottle Brain page contract.
3. Identify whether current repo already has a bottle detail route worth upgrading, or if one should be added.
4. Implement Slice 1 first.
5. Validate against live seeded data, not only mocks.
6. Then move directly into Tonight Engine and Command Center.

## Recommended next build order
- Slice 1: Bottle Brain v1
- Slice 2: Tonight Engine v1
- Slice 3: Command Center v1
- Slice 4: Taste Genome v1
- Slice 5: Portfolio Truth v1

## Non-goals for now
- broad social mechanics before core magic exists
- shallow AI chat without product intelligence underneath it
- sprawling settings/admin work ahead of user delight
- fake financial claims without confidence labeling
- overbuilding winery/social before the bottle loop is world-class

## Final standard
A world-class Pourfolio should make a user say:
- this app knows my cellar better than I do
- this app knows my taste better than I can explain it
- this app helps me choose better bottles, create better moments, and remember them forever

That is the bar.
