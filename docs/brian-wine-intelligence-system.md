# Brian Wine Intelligence System

## Mission

Turn Pourfolio from a cellar tracker into Brian Lewis's personal wine intelligence system.

This system should do four things exceptionally well:
1. remember every wine Brian rates
2. learn Brian's actual palate, not generic critic taste
3. recommend bottles Brian will likely love before he buys or opens them
4. explain comparisons in Brian terms: smooth, bold, earthy, spicy, casual, steak-night, impressive, rebuy, skip

## Core Product Thesis

Most wine apps track inventory.
This one should track taste judgment.

The moat is not just label recognition or cellar counts.
The moat is a living preference model built from Brian's own ratings, descriptors, repeat buys, and context.

## North Star Outcome

Brian can send a photo or wine name and immediately get:
- expected Brian-fit score
- likely style match to his palate
- comparison to prior wines he rated
- confidence level
- whether to buy, drink now, rebuy, cellar, or skip
- what food / occasion it best fits

## Dual-Score Model

Every wine should support two distinct scores.

### 1. Quality Score
A broad quality estimate, from Brian or external sources.
This answers: "How good is this wine overall?"

### 2. Brian-Fit Score
A personalized score predicting how much Brian will like it.
This answers: "How right is this wine for Brian specifically?"

This second score is the true product advantage.

## Taste Profile Model

For each rating, capture structured preference signals.

### Required fields
- wine_name
- producer
- vintage
- varietal
- region
- wine_type
- brian_score_100
- letter_grade
- tasted_on
- source_type (photo, manual, URL, recommendation, restaurant)

### Brian palate attributes
Use 1 to 5 or normalized low/medium/high scales.
- smoothness
- boldness
- earthiness
- spiciness
- fruit_forward
- dryness
- tannin_strength
- acidity_level
- finish_length
- richness

### Decision tags
- casual-drinker
- weeknight
- steak-night
- pasta-night
- impressive
- buy-again
- giftable
- value-buy
- special-occasion
- not-my-style

### Language memory
Store the exact natural-language phrases Brian uses.
Examples:
- very smooth
- not extremely bold
- not earthy enough
- easy casual drinking wine
- good steak wine
- too thin
- would buy again

These phrases should be preserved as first-class signals, not reduced away.

## Recommendation Engine

Recommendations should be generated from five layers.

### Layer 1. Similarity matching
Given a new wine, compare it against wines Brian rated highly or poorly.

Outputs:
- most similar loved wines
- most similar disliked wines
- nearest palate cluster

### Layer 2. Occasion matching
Recommend by scenario:
- tonight at home
- steak dinner
- dinner party
- impressive bottle
- easy weeknight pour
- value under budget

### Layer 3. Price intelligence
Recommend by value band:
- under $20
- $20 to $35
- $35 to $60
- splurge

Track where Brian gets the best hit rate for satisfaction.

### Layer 4. Producer and region pattern learning
Learn patterns like:
- Brian tends to like Santa Cruz Mountains cabs more than Napa fruit bombs
- Brian likes polished cabs but wants more earth/spice for elite scores
- Brian over-indexes on smooth reds with enough structure but dislikes jammy softness

### Layer 5. Buy / drink / skip decisioning
Every recommendation should end in a clear action:
- buy confidently
- buy if discounted
- drink now
- cellar for later
- good but not your ideal style
- skip

## Experience Modes

### A. Quick photo intake
Brian sends a bottle photo.
System returns:
- identified wine
- predicted Brian-fit
- comparison to prior wines
- likely notes / style
- recommendation
- one-tap save to history

### B. Rating capture mode
After Brian drinks a wine, capture:
- score
- grade
- quick voice/text note
- style sliders or inferred traits
- would buy again yes/no

### C. Shopping advisor mode
Brian sees a bottle in a store or online.
He sends a photo or URL.
System returns:
- predicted fit
- similar wines from history
- whether this is on-profile
- better alternatives if not

### D. Cellar decision mode
From the bottles he owns, recommend:
- best bottle for tonight
- safest crowd-pleaser
- best steak pairing
- highest-value bottle to drink soon
- bottles underperforming in value or fit

## Data Model Upgrades

## New table: brian_taste_profiles
One row per user for current learned palate profile.

Suggested fields:
- user_id
- preferred_smoothness
- preferred_boldness
- preferred_earthiness
- preferred_spiciness
- preferred_fruit_forward
- preferred_tannin
- preferred_acidity
- preferred_richness
- confidence_score
- profile_summary
- updated_at

## New table: rating_signals
One row per rating for structured extracted preference signals.

Suggested fields:
- id
- rating_id
- user_id
- smoothness
- boldness
- earthiness
- spiciness
- fruit_forward
- dryness
- tannins
- acidity
- finish_length
- richness
- buy_again
- value_feel
- occasion_tags text[]
- decision_tags text[]
- brian_phrases text[]
- extracted_from_text jsonb
- created_at

## New table: recommendation_explanations
Persist recommendation reasoning for trust and tuning.

Suggested fields:
- id
- user_id
- source_inventory_id nullable
- source_wine_reference_id nullable
- candidate_name
- predicted_brian_fit
- predicted_quality_score nullable
- explanation
- similar_loved_wines jsonb
- similar_disliked_wines jsonb
- action_recommendation
- created_at

## Analytics That Actually Matter

### Personal taste analytics
- average score by wine type
- average score by varietal
- average score by region
- average score by price band
- score distribution by smoothness/boldness/earthiness/spiciness
- rebuy rate
- buy-again by producer and region

### Decision analytics
- best-value producers
- most reliable regions
- styles Brian thinks are quality but does not personally love
- styles Brian repeatedly overestimates before tasting
- hidden winners under price thresholds

## AI Layer

Use the AI layer for three jobs only.

### 1. Extract structured preference signals
Convert Brian's natural tasting language into structured features.
Example:
"Very smooth, good casual drinking wine, not extremely bold and earthy and spicy like I like"
becomes:
- smoothness: high
- boldness: medium-low
- earthiness: low
- spiciness: low
- casual-drinker: true
- brian_phrases: preserved exact quote

### 2. Generate comparison language
Produce explanations like:
- smoother and easier than your typical favorite cab
- less earthy than the bottles you score 95+
- similar to Martin Ray, but with more spice and more structure

### 3. Predict Brian-fit score on new wines
Based on learned history plus known wine metadata.

## Product Differentiators

This system should feel different because it:
- learns Brian's palate instead of crowd averages
- remembers context and language, not just scores
- gives a decision, not just tasting notes
- turns every bottle into training data for future buying

## First Build Phases

### Phase 1. Foundation
- add Brian wine journal file
- define structured rating schema
- seed first wine entry
- capture exact Brian descriptors

### Phase 2. App schema
- add rating_signals and brian_taste_profiles tables
- extend rating UI to capture Brian-fit data
- create history and comparison views

### Phase 3. Recommendation intelligence
- add Brian-fit prediction engine
- add comparison explanations
- add shopping advisor mode

### Phase 4. Moonshot polish
- photo-first intake from Telegram
- voice tasting notes
- personalized buying radar
- proactive suggestions by budget and occasion

## Immediate Seed Entry

### Martin Ray Cabernet Sauvignon 2022, Santa Cruz Mountains
- quality impression: A-
- brian_score_100: 93
- profile summary: very smooth, good casual drinking wine
- tradeoff summary: not as bold, earthy, or spicy as Brian ideally prefers for top-tier scores
- likely fit tags: casual-drinker, weeknight, polished-cab, easy-drinking
- recommendation takeaway: strong fit for smooth everyday red drinking, weaker fit for deep bold earthy spicy craving

## Executive Recommendation

Build this as Brian's personal wine memory and buying advantage engine.
Do not frame it as a generic tasting journal.
The right product promise is:

"Show me a wine and tell me if future me will actually love it."