# Slice 1 Spec — Bottle Brain v1

## Mission
Make every bottle in Pourfolio feel like a living intelligence object, not a database row.

Bottle Brain v1 is the first heroic slice because it creates the quality bar for the whole product. If we cannot make one bottle page feel world-class, the rest of the app will remain a collection of features instead of a great product.

## Why this slice goes first
Live project truth says the real current gravity is:
- cellar inventory
- custom/manual wine entries
- ratings and tasting notes
- wine photos
- basic market value tracking

That means the fastest path to world-class is not social, not winery visits, and not wishlist expansion. It is turning the bottle itself into the center of gravity.

## User promise
When I open a bottle in Pourfolio, I should understand in seconds:
- what it is
- why I own it
- whether it is ready
- what it is worth
- what I thought before
- what I should do next

## Product doctrine
Bottle Brain must feel:
- editorial, not administrative
- intimate, not generic
- decisive, not informational only
- premium, not cluttered
- equally strong for custom wines and linked reference wines

## Current live-data realities Bottle Brain must handle
The implementation must handle all of these cleanly:
- bottles with `wine_reference_id = null`
- bottles with custom-only fields such as:
  - `custom_name`
  - `custom_producer`
  - `custom_vintage`
  - `custom_wine_type`
  - `custom_region`
- bottles with photos
- bottles with ratings but sparse structured metadata
- bottles with missing purchase price or missing market value
- bottles with missing drinking windows
- data quality edge cases such as malformed vintages

## Primary user jobs
1. Decide whether to open this bottle now.
2. Remember what this bottle is and why it matters.
3. See all prior interaction with the bottle in one place.
4. Decide whether to hold, drink, gift, or buy more.
5. Improve missing data without friction.

## Core experience

## Page structure

### 1. Hero identity rail
Top of page should show the bottle as an object of desire and context.

Must include:
- bottle display name
- producer
- vintage
- wine type
- region / country
- custom-vs-reference badge only if useful, never ugly
- primary image if available
- quantity on hand
- storage location

Principle:
The first screen should feel like you are looking at the bottle, not a form.

### 2. Operator brief
Immediately under the hero, show three concise cards:
- What matters now
- Best next move
- Risk if ignored

Examples:
- "Peak window unknown. You have not rated this bottle yet."
- "Open on a steak night or add a quick market-value estimate."
- "Without a note, this becomes another expensive bottle you vaguely remember liking."

This is the command surface of the page.

### 3. Readiness + decision rail
Show the bottle's current recommendation state.

Primary outputs:
- Drink now
- Hold
- Revisit later
- Great for guests
- Candidate to gift
- Buy more if found

Each recommendation must explain why.

Version 1 logic should consider:
- drink window if available
- age vs vintage
- prior ratings
- quantity remaining
- market value vs purchase price
- whether it has ever been tasted

### 4. Memory and tasting rail
This is where the bottle becomes personal.

Include:
- latest tasting note
- prior scores over time
- nose / palate / finish summaries if present
- who it was shared with if known later
- occasion or context tags where available
- one-tap path to add a fresh tasting reflection

Principle:
If the bottle has history, it should feel alive.
If it has no history, the page should invite the first memory.

### 5. Value and portfolio rail
Financial truth should be clear and honest.

Show:
- purchase price
- current market value
- source of value
- last updated date
- confidence state:
  - known
  - manual estimate
  - unknown
- gain/loss if valid

Principle:
No fake precision. Unknown must be treated as honest unknown.

### 6. Provenance and acquisition rail
Show:
- purchase date
- purchase location
- source or vendor if known
- bottle size
- tags / notes

This helps the bottle feel collected, not merely stored.

### 7. Photo rail
A premium image experience matters.

Version 1 requirements:
- hero image if primary exists
- gallery strip for additional photos
- empty state that invites label/bottle photo upload

### 8. Data quality and enrichment rail
This should be subtle but useful.

Potential prompts:
- vintage looks malformed
- missing wine type
- missing region
- no drink window
- no market value
- not linked to wine reference

Do not present as error spam.
Present as one clean "Improve this bottle" module.

## Core interactions

### Primary CTA set
Top-level actions should be:
- Add tasting
- Mark opened / track glasses
- Update value
- Edit bottle
- Upload photo

### Secondary actions
- Consume bottle
- Restore bottle
- Add to wishlist / rebuy later
- Gift candidate tag
- Link to wine reference

## Information hierarchy rules
- Hero first
- operator brief second
- decision rail third
- memory before admin
- value before metadata dump
- metadata only after meaning is established

## Logic rules

### Display-name resolution
Canonical order:
1. reference wine name
2. custom name
3. fallback label like "Unnamed bottle"

### Producer resolution
Canonical order:
1. reference producer
2. custom producer
3. fallback "Unknown producer"

### Region resolution
Canonical order:
1. reference region
2. reference country
3. custom region
4. fallback "Region unknown"

### Vintage resolution
Canonical order:
1. inventory vintage
2. custom vintage
3. fallback absent state

### Reference vs custom handling
Custom bottles must never look degraded or unfinished.
A custom bottle should still feel premium even when reference linkage is absent.

## UX quality bar
Bottle Brain v1 is successful only if:
- a bottle can be understood in under 10 seconds
- custom bottles feel first-class
- the page tells the user what to do next
- value coverage is honest
- missing information becomes actionable, not annoying
- page feels more like a private sommelier desk than a CRUD form

## Technical implementation shape

### Likely inputs
- `cellar_inventory`
- `wine_reference`
- `ratings`
- `wine_photos`
- `market_value_history`
- `cellar_locations`
- maybe `purchases` if available

### Likely output contract
Create a single computed view-model for Bottle Brain that normalizes:
- title
- subtitle
- hero image
- quantity
- location label
- readiness state
- value summary
- tasting summary
- operator brief strings
- improvement prompts

This normalization layer matters because current data is mixed between reference-backed and custom-only inventory.

## Edge cases
- no image
- no ratings
- no market value
- no purchase price
- no drink window
- custom-only bottle
- malformed vintage
- multiple photos but no primary flag
- quantity zero or consumed state

## Suggested file deliverables
These exact names may change after reading route structure, but Slice 1 should likely create or upgrade:
- bottle detail page route
- bottle-brain view-model helper
- bottle hero component
- operator brief component
- tasting memory card
- value truth card
- improve-this-bottle card

## Definition of done
Slice 1 is done when:
- one bottle page exists and is production-quality
- it works against real live seeded data
- it handles both custom and reference-backed bottles gracefully
- it clearly recommends a next action
- it visually feels premium enough to become the design bar for the rest of the product

## Recommended immediate execution after this spec
1. Inspect the current route structure for existing cellar/bottle detail pages.
2. Choose whether to upgrade an existing route or add a canonical bottle detail route.
3. Define the Bottle Brain data-mapper/view-model.
4. Build the hero + operator brief + memory + value rails first.
5. Validate using the real seeded bottles already present in the live project.

## Final standard
When Bottle Brain v1 ships, Brian should be able to open one bottle page and say:
"Yes. This is no longer a wine inventory app. This is the beginning of the best wine product in the world."
