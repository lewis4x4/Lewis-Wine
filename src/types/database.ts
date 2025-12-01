export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      wine_reference: {
        Row: {
          id: string;
          lwin: string | null;
          barcode: string | null;
          name: string;
          producer: string | null;
          region: string | null;
          sub_region: string | null;
          country: string | null;
          appellation: string | null;
          grape_varieties: string[] | null;
          wine_type: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null;
          alcohol_percentage: number | null;
          classification: string | null;
          drink_window_start: number | null;
          drink_window_end: number | null;
          critic_scores: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lwin?: string | null;
          barcode?: string | null;
          name: string;
          producer?: string | null;
          region?: string | null;
          sub_region?: string | null;
          country?: string | null;
          appellation?: string | null;
          grape_varieties?: string[] | null;
          wine_type?: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null;
          alcohol_percentage?: number | null;
          classification?: string | null;
          drink_window_start?: number | null;
          drink_window_end?: number | null;
          critic_scores?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lwin?: string | null;
          barcode?: string | null;
          name?: string;
          producer?: string | null;
          region?: string | null;
          sub_region?: string | null;
          country?: string | null;
          appellation?: string | null;
          grape_varieties?: string[] | null;
          wine_type?: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null;
          alcohol_percentage?: number | null;
          classification?: string | null;
          drink_window_start?: number | null;
          drink_window_end?: number | null;
          critic_scores?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      cellars: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          total_bottles: number;
          total_value_cents: number;
          location_mode: "simple" | "structured" | "grid";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string;
          description?: string | null;
          total_bottles?: number;
          total_value_cents?: number;
          location_mode?: "simple" | "structured" | "grid";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          total_bottles?: number;
          total_value_cents?: number;
          location_mode?: "simple" | "structured" | "grid";
          created_at?: string;
          updated_at?: string;
        };
      };
      cellar_locations: {
        Row: {
          id: string;
          cellar_id: string;
          name: string | null;
          zone: string | null;
          rack: string | null;
          shelf: string | null;
          position: string | null;
          capacity: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          cellar_id: string;
          name?: string | null;
          zone?: string | null;
          rack?: string | null;
          shelf?: string | null;
          position?: string | null;
          capacity?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          cellar_id?: string;
          name?: string | null;
          zone?: string | null;
          rack?: string | null;
          shelf?: string | null;
          position?: string | null;
          capacity?: number;
          sort_order?: number;
          created_at?: string;
        };
      };
      cellar_inventory: {
        Row: {
          id: string;
          cellar_id: string;
          wine_reference_id: string | null;
          location_id: string | null;
          simple_location: string | null;
          custom_name: string | null;
          custom_producer: string | null;
          custom_vintage: number | null;
          vintage: number | null;
          quantity: number;
          bottle_size_ml: number;
          purchase_date: string | null;
          purchase_price_cents: number | null;
          purchase_location: string | null;
          drink_after: string | null;
          drink_before: string | null;
          status: "in_cellar" | "consumed" | "gifted" | "sold";
          consumed_date: string | null;
          label_image_url: string | null;
          notes: string | null;
          tags: string[] | null;
          low_stock_threshold: number | null;
          low_stock_alert_enabled: boolean;
          // Financial tracking fields
          current_market_value_cents: number | null;
          market_value_source: MarketValueSource | null;
          market_value_updated_at: string | null;
          is_opened: boolean;
          opened_date: string | null;
          glasses_poured: number;
          glasses_per_bottle: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cellar_id: string;
          wine_reference_id?: string | null;
          location_id?: string | null;
          simple_location?: string | null;
          custom_name?: string | null;
          custom_producer?: string | null;
          custom_vintage?: number | null;
          vintage?: number | null;
          quantity?: number;
          bottle_size_ml?: number;
          purchase_date?: string | null;
          purchase_price_cents?: number | null;
          purchase_location?: string | null;
          drink_after?: string | null;
          drink_before?: string | null;
          status?: "in_cellar" | "consumed" | "gifted" | "sold";
          consumed_date?: string | null;
          label_image_url?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          low_stock_threshold?: number | null;
          low_stock_alert_enabled?: boolean;
          // Financial tracking fields
          current_market_value_cents?: number | null;
          market_value_source?: MarketValueSource | null;
          market_value_updated_at?: string | null;
          is_opened?: boolean;
          opened_date?: string | null;
          glasses_poured?: number;
          glasses_per_bottle?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cellar_id?: string;
          wine_reference_id?: string | null;
          location_id?: string | null;
          simple_location?: string | null;
          custom_name?: string | null;
          custom_producer?: string | null;
          custom_vintage?: number | null;
          vintage?: number | null;
          quantity?: number;
          bottle_size_ml?: number;
          purchase_date?: string | null;
          purchase_price_cents?: number | null;
          purchase_location?: string | null;
          drink_after?: string | null;
          drink_before?: string | null;
          status?: "in_cellar" | "consumed" | "gifted" | "sold";
          consumed_date?: string | null;
          label_image_url?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          low_stock_threshold?: number | null;
          low_stock_alert_enabled?: boolean;
          // Financial tracking fields
          current_market_value_cents?: number | null;
          market_value_source?: MarketValueSource | null;
          market_value_updated_at?: string | null;
          is_opened?: boolean;
          opened_date?: string | null;
          glasses_poured?: number;
          glasses_per_bottle?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      ratings: {
        Row: {
          id: string;
          user_id: string;
          inventory_id: string | null;
          wine_reference_id: string | null;
          score: number;
          tasting_notes: string | null;
          appearance_notes: string | null;
          nose_notes: string | null;
          palate_notes: string | null;
          occasion: string | null;
          food_pairing: string | null;
          tasting_date: string;
          created_at: string;
          // Enhanced tasting experience fields
          aroma_notes: AromaNotes | null;
          body: BodyLevel | null;
          tannins: TanninLevel | null;
          acidity: AcidityLevel | null;
          sweetness: SweetnessLevel | null;
          finish: FinishLength | null;
          intensity: IntensityLevel | null;
          quality_level: QualityLevel | null;
          companions: string[] | null;
          occasion_tags: string[] | null;
          venue: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          inventory_id?: string | null;
          wine_reference_id?: string | null;
          score: number;
          tasting_notes?: string | null;
          appearance_notes?: string | null;
          nose_notes?: string | null;
          palate_notes?: string | null;
          occasion?: string | null;
          food_pairing?: string | null;
          tasting_date?: string;
          created_at?: string;
          // Enhanced tasting experience fields
          aroma_notes?: AromaNotes | null;
          body?: BodyLevel | null;
          tannins?: TanninLevel | null;
          acidity?: AcidityLevel | null;
          sweetness?: SweetnessLevel | null;
          finish?: FinishLength | null;
          intensity?: IntensityLevel | null;
          quality_level?: QualityLevel | null;
          companions?: string[] | null;
          occasion_tags?: string[] | null;
          venue?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          inventory_id?: string | null;
          wine_reference_id?: string | null;
          score?: number;
          tasting_notes?: string | null;
          appearance_notes?: string | null;
          nose_notes?: string | null;
          palate_notes?: string | null;
          occasion?: string | null;
          food_pairing?: string | null;
          tasting_date?: string;
          created_at?: string;
          // Enhanced tasting experience fields
          aroma_notes?: AromaNotes | null;
          body?: BodyLevel | null;
          tannins?: TanninLevel | null;
          acidity?: AcidityLevel | null;
          sweetness?: SweetnessLevel | null;
          finish?: FinishLength | null;
          intensity?: IntensityLevel | null;
          quality_level?: QualityLevel | null;
          companions?: string[] | null;
          occasion_tags?: string[] | null;
          venue?: string | null;
        };
      };
      food_pairings: {
        Row: {
          id: string;
          rating_id: string;
          user_id: string;
          dish_name: string;
          dish_category: DishCategory | null;
          cuisine_type: string | null;
          pairing_rating: number | null;
          pairing_notes: string | null;
          would_recommend: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          rating_id: string;
          user_id: string;
          dish_name: string;
          dish_category?: DishCategory | null;
          cuisine_type?: string | null;
          pairing_rating?: number | null;
          pairing_notes?: string | null;
          would_recommend?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          rating_id?: string;
          user_id?: string;
          dish_name?: string;
          dish_category?: DishCategory | null;
          cuisine_type?: string | null;
          pairing_rating?: number | null;
          pairing_notes?: string | null;
          would_recommend?: boolean;
          created_at?: string;
        };
      };
      occasion_presets: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          slug: string;
          icon: string | null;
          is_default: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          slug: string;
          icon?: string | null;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          slug?: string;
          icon?: string | null;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
        };
      };
      companion_presets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          relationship: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          relationship?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          relationship?: string | null;
          created_at?: string;
        };
      };
      aroma_reference: {
        Row: {
          id: string;
          category: "primary" | "secondary" | "tertiary";
          subcategory: string | null;
          name: string;
          wine_types: string[] | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          category: "primary" | "secondary" | "tertiary";
          subcategory?: string | null;
          name: string;
          wine_types?: string[] | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          category?: "primary" | "secondary" | "tertiary";
          subcategory?: string | null;
          name?: string;
          wine_types?: string[] | null;
          sort_order?: number;
        };
      };
      purchases: {
        Row: {
          id: string;
          user_id: string;
          inventory_id: string | null;
          wine_reference_id: string | null;
          quantity: number;
          price_per_bottle_cents: number | null;
          total_price_cents: number | null;
          currency: string;
          purchase_date: string;
          vendor: string | null;
          vendor_type: "winery" | "retailer" | "auction" | "private" | "other" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          inventory_id?: string | null;
          wine_reference_id?: string | null;
          quantity: number;
          price_per_bottle_cents?: number | null;
          total_price_cents?: number | null;
          currency?: string;
          purchase_date: string;
          vendor?: string | null;
          vendor_type?: "winery" | "retailer" | "auction" | "private" | "other" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          inventory_id?: string | null;
          wine_reference_id?: string | null;
          quantity?: number;
          price_per_bottle_cents?: number | null;
          total_price_cents?: number | null;
          currency?: string;
          purchase_date?: string;
          vendor?: string | null;
          vendor_type?: "winery" | "retailer" | "auction" | "private" | "other" | null;
          created_at?: string;
        };
      };
      wishlist: {
        Row: {
          id: string;
          user_id: string;
          wine_reference_id: string | null;
          custom_name: string | null;
          custom_producer: string | null;
          custom_region: string | null;
          custom_vintage: number | null;
          custom_wine_type: WineType | null;
          priority: WishlistPriority;
          target_price_cents: number | null;
          max_price_cents: number | null;
          desired_quantity: number;
          source: string | null;
          source_details: string | null;
          notes: string | null;
          status: WishlistStatus;
          purchased_date: string | null;
          purchased_price_cents: number | null;
          purchased_from: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          wine_reference_id?: string | null;
          custom_name?: string | null;
          custom_producer?: string | null;
          custom_region?: string | null;
          custom_vintage?: number | null;
          custom_wine_type?: WineType | null;
          priority?: WishlistPriority;
          target_price_cents?: number | null;
          max_price_cents?: number | null;
          desired_quantity?: number;
          source?: string | null;
          source_details?: string | null;
          notes?: string | null;
          status?: WishlistStatus;
          purchased_date?: string | null;
          purchased_price_cents?: number | null;
          purchased_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          wine_reference_id?: string | null;
          custom_name?: string | null;
          custom_producer?: string | null;
          custom_region?: string | null;
          custom_vintage?: number | null;
          custom_wine_type?: WineType | null;
          priority?: WishlistPriority;
          target_price_cents?: number | null;
          max_price_cents?: number | null;
          desired_quantity?: number;
          source?: string | null;
          source_details?: string | null;
          notes?: string | null;
          status?: WishlistStatus;
          purchased_date?: string | null;
          purchased_price_cents?: number | null;
          purchased_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shopping_list: {
        Row: {
          id: string;
          user_id: string;
          inventory_id: string | null;
          wine_reference_id: string | null;
          custom_name: string | null;
          custom_producer: string | null;
          custom_vintage: number | null;
          quantity_needed: number;
          urgency: ShoppingUrgency;
          last_purchase_price_cents: number | null;
          target_price_cents: number | null;
          preferred_vendors: string[] | null;
          notes: string | null;
          reason: string | null;
          status: ShoppingStatus;
          purchased_date: string | null;
          purchased_quantity: number | null;
          purchased_price_cents: number | null;
          purchased_from: string | null;
          auto_generated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          inventory_id?: string | null;
          wine_reference_id?: string | null;
          custom_name?: string | null;
          custom_producer?: string | null;
          custom_vintage?: number | null;
          quantity_needed?: number;
          urgency?: ShoppingUrgency;
          last_purchase_price_cents?: number | null;
          target_price_cents?: number | null;
          preferred_vendors?: string[] | null;
          notes?: string | null;
          reason?: string | null;
          status?: ShoppingStatus;
          purchased_date?: string | null;
          purchased_quantity?: number | null;
          purchased_price_cents?: number | null;
          purchased_from?: string | null;
          auto_generated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          inventory_id?: string | null;
          wine_reference_id?: string | null;
          custom_name?: string | null;
          custom_producer?: string | null;
          custom_vintage?: number | null;
          quantity_needed?: number;
          urgency?: ShoppingUrgency;
          last_purchase_price_cents?: number | null;
          target_price_cents?: number | null;
          preferred_vendors?: string[] | null;
          notes?: string | null;
          reason?: string | null;
          status?: ShoppingStatus;
          purchased_date?: string | null;
          purchased_quantity?: number | null;
          purchased_price_cents?: number | null;
          purchased_from?: string | null;
          auto_generated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      winery_visits: {
        Row: {
          id: string;
          user_id: string;
          winery_name: string;
          winery_region: string | null;
          winery_country: string | null;
          winery_website: string | null;
          winery_address: string | null;
          visit_date: string;
          visit_type: VisitType;
          reservation_required: boolean | null;
          tasting_fee_cents: number | null;
          tasting_fee_waived: boolean;
          overall_rating: number | null;
          atmosphere_rating: number | null;
          service_rating: number | null;
          wine_quality_rating: number | null;
          value_rating: number | null;
          companions: string[] | null;
          highlights: string | null;
          notes: string | null;
          would_return: boolean | null;
          recommended_for: string | null;
          photo_urls: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          winery_name: string;
          winery_region?: string | null;
          winery_country?: string | null;
          winery_website?: string | null;
          winery_address?: string | null;
          visit_date: string;
          visit_type?: VisitType;
          reservation_required?: boolean | null;
          tasting_fee_cents?: number | null;
          tasting_fee_waived?: boolean;
          overall_rating?: number | null;
          atmosphere_rating?: number | null;
          service_rating?: number | null;
          wine_quality_rating?: number | null;
          value_rating?: number | null;
          companions?: string[] | null;
          highlights?: string | null;
          notes?: string | null;
          would_return?: boolean | null;
          recommended_for?: string | null;
          photo_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          winery_name?: string;
          winery_region?: string | null;
          winery_country?: string | null;
          winery_website?: string | null;
          winery_address?: string | null;
          visit_date?: string;
          visit_type?: VisitType;
          reservation_required?: boolean | null;
          tasting_fee_cents?: number | null;
          tasting_fee_waived?: boolean;
          overall_rating?: number | null;
          atmosphere_rating?: number | null;
          service_rating?: number | null;
          wine_quality_rating?: number | null;
          value_rating?: number | null;
          companions?: string[] | null;
          highlights?: string | null;
          notes?: string | null;
          would_return?: boolean | null;
          recommended_for?: string | null;
          photo_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      winery_visit_wines: {
        Row: {
          id: string;
          visit_id: string;
          user_id: string;
          wine_reference_id: string | null;
          wine_name: string;
          wine_type: WineType | null;
          vintage: number | null;
          rating: number | null;
          tasting_notes: string | null;
          purchased: boolean;
          quantity_purchased: number | null;
          price_per_bottle_cents: number | null;
          added_to_wishlist: boolean;
          interested_in_buying: boolean;
          tasting_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          user_id: string;
          wine_reference_id?: string | null;
          wine_name: string;
          wine_type?: WineType | null;
          vintage?: number | null;
          rating?: number | null;
          tasting_notes?: string | null;
          purchased?: boolean;
          quantity_purchased?: number | null;
          price_per_bottle_cents?: number | null;
          added_to_wishlist?: boolean;
          interested_in_buying?: boolean;
          tasting_order?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          user_id?: string;
          wine_reference_id?: string | null;
          wine_name?: string;
          wine_type?: WineType | null;
          vintage?: number | null;
          rating?: number | null;
          tasting_notes?: string | null;
          purchased?: boolean;
          quantity_purchased?: number | null;
          price_per_bottle_cents?: number | null;
          added_to_wishlist?: boolean;
          interested_in_buying?: boolean;
          tasting_order?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      wine_type: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified";
      inventory_status: "in_cellar" | "consumed" | "gifted" | "sold";
      vendor_type: "winery" | "retailer" | "auction" | "private" | "other";
      location_mode: "simple" | "structured" | "grid";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Convenience types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type WineReference = Database["public"]["Tables"]["wine_reference"]["Row"];
export type Cellar = Database["public"]["Tables"]["cellars"]["Row"];
export type CellarLocation = Database["public"]["Tables"]["cellar_locations"]["Row"];
export type CellarInventory = Database["public"]["Tables"]["cellar_inventory"]["Row"];
export type Rating = Database["public"]["Tables"]["ratings"]["Row"];
export type Purchase = Database["public"]["Tables"]["purchases"]["Row"];

// Insert types
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type WineReferenceInsert = Database["public"]["Tables"]["wine_reference"]["Insert"];
export type CellarInsert = Database["public"]["Tables"]["cellars"]["Insert"];
export type CellarInventoryInsert = Database["public"]["Tables"]["cellar_inventory"]["Insert"];
export type RatingInsert = Database["public"]["Tables"]["ratings"]["Insert"];

// Joined types for queries
export type CellarInventoryWithWine = CellarInventory & {
  wine_reference: WineReference | null;
  ratings: Rating[];
  location?: CellarLocation | null;
};

// Location mode type
export type LocationMode = "simple" | "structured" | "grid";

// Notification preferences type
export type NotificationPreferences = {
  drinking_window_in_app: boolean;
  drinking_window_push: boolean;
  drinking_window_email: boolean;
  low_stock_in_app: boolean;
  low_stock_push: boolean;
  email_digest_day: "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
};

// Tasting Experience Types
export type AromaNotes = {
  primary?: string[];
  secondary?: string[];
  tertiary?: string[];
};

export type BodyLevel = "light" | "medium-light" | "medium" | "medium-full" | "full";
export type TanninLevel = "none" | "low" | "medium-low" | "medium" | "medium-high" | "high";
export type AcidityLevel = "low" | "medium-low" | "medium" | "medium-high" | "high";
export type SweetnessLevel = "bone-dry" | "dry" | "off-dry" | "medium-sweet" | "sweet";
export type FinishLength = "short" | "medium" | "long" | "very-long";
export type IntensityLevel = "delicate" | "moderate" | "powerful";
export type QualityLevel = "poor" | "acceptable" | "good" | "very-good" | "outstanding" | "exceptional";

export type DishCategory =
  | "appetizer"
  | "soup"
  | "salad"
  | "pasta"
  | "seafood"
  | "poultry"
  | "beef"
  | "pork"
  | "lamb"
  | "game"
  | "vegetarian"
  | "cheese"
  | "dessert"
  | "other";

// Export new table types
export type FoodPairing = Database["public"]["Tables"]["food_pairings"]["Row"];
export type FoodPairingInsert = Database["public"]["Tables"]["food_pairings"]["Insert"];
export type OccasionPreset = Database["public"]["Tables"]["occasion_presets"]["Row"];
export type CompanionPreset = Database["public"]["Tables"]["companion_presets"]["Row"];
export type AromaReference = Database["public"]["Tables"]["aroma_reference"]["Row"];

// Rating with food pairings
export type RatingWithPairings = Rating & {
  food_pairings?: FoodPairing[];
};

// Financial Tracking Types
export type MarketValueSource = "manual" | "wine-searcher" | "vivino" | "estimate";

export type MarketValueHistory = {
  id: string;
  inventory_id: string;
  value_cents: number;
  source: MarketValueSource | null;
  source_url: string | null;
  notes: string | null;
  recorded_at: string;
};

export type PortfolioSnapshot = {
  id: string;
  user_id: string;
  cellar_id: string;
  total_bottles: number;
  total_purchase_value_cents: number;
  total_market_value_cents: number;
  value_by_type: Record<string, { bottles: number; purchase: number; market: number }>;
  value_by_region: Record<string, { bottles: number; purchase: number; market: number }>;
  snapshot_date: string;
  created_at: string;
};

export type PriceAlertType = "threshold_above" | "threshold_below" | "percentage_change";

export type PriceAlert = {
  id: string;
  user_id: string;
  inventory_id: string;
  alert_type: PriceAlertType;
  threshold_cents: number | null;
  percentage_change: number | null;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
};

// Cellar value calculation result
export type CellarValueSummary = {
  total_bottles: number;
  total_purchase_cents: number;
  total_market_cents: number;
  gain_loss_cents: number;
  gain_loss_percentage: number;
};

// Wine with financial data
export type CellarInventoryWithValue = CellarInventory & {
  wine_reference: WineReference | null;
  gain_loss_cents?: number;
  gain_loss_percentage?: number;
  price_per_glass_cents?: number;
};

// Discovery & Planning Types
export type WineType = "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified";

// Wishlist types
export type WishlistPriority = "low" | "medium" | "high" | "must-have";
export type WishlistStatus = "active" | "purchased" | "unavailable" | "removed";
export type Wishlist = Database["public"]["Tables"]["wishlist"]["Row"];
export type WishlistInsert = Database["public"]["Tables"]["wishlist"]["Insert"];
export type WishlistUpdate = Database["public"]["Tables"]["wishlist"]["Update"];

export type WishlistWithWine = Wishlist & {
  wine_reference: WineReference | null;
};

// Shopping List types
export type ShoppingUrgency = "low" | "normal" | "high" | "urgent";
export type ShoppingStatus = "active" | "purchased" | "cancelled";
export type ShoppingList = Database["public"]["Tables"]["shopping_list"]["Row"];
export type ShoppingListInsert = Database["public"]["Tables"]["shopping_list"]["Insert"];
export type ShoppingListUpdate = Database["public"]["Tables"]["shopping_list"]["Update"];

export type ShoppingListWithWine = ShoppingList & {
  wine_reference: WineReference | null;
  cellar_inventory: CellarInventory | null;
};

// Winery Visit types
export type VisitType = "tasting" | "tour" | "tour-and-tasting" | "pickup" | "event" | "other";
export type WineryVisit = Database["public"]["Tables"]["winery_visits"]["Row"];
export type WineryVisitInsert = Database["public"]["Tables"]["winery_visits"]["Insert"];
export type WineryVisitUpdate = Database["public"]["Tables"]["winery_visits"]["Update"];

export type WineryVisitWine = Database["public"]["Tables"]["winery_visit_wines"]["Row"];
export type WineryVisitWineInsert = Database["public"]["Tables"]["winery_visit_wines"]["Insert"];
export type WineryVisitWineUpdate = Database["public"]["Tables"]["winery_visit_wines"]["Update"];

export type WineryVisitWithWines = WineryVisit & {
  winery_visit_wines: WineryVisitWine[];
};

// Social Types
export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";
export type TastingVisibility = "friends" | "public";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

export type FriendshipInsert = {
  id?: string;
  requester_id: string;
  addressee_id: string;
  status?: FriendshipStatus;
  created_at?: string;
  updated_at?: string;
};

export type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type UserProfileInsert = {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type UserProfileUpdate = {
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  is_public?: boolean;
  updated_at?: string;
};

export type SharedTasting = {
  id: string;
  user_id: string;
  rating_id: string;
  visibility: TastingVisibility;
  caption: string | null;
  created_at: string;
  updated_at: string;
};

export type SharedTastingInsert = {
  id?: string;
  user_id: string;
  rating_id: string;
  visibility?: TastingVisibility;
  caption?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TastingLike = {
  id: string;
  shared_tasting_id: string;
  user_id: string;
  created_at: string;
};

export type TastingLikeInsert = {
  id?: string;
  shared_tasting_id: string;
  user_id: string;
  created_at?: string;
};

export type TastingComment = {
  id: string;
  shared_tasting_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type TastingCommentInsert = {
  id?: string;
  shared_tasting_id: string;
  user_id: string;
  content: string;
  created_at?: string;
  updated_at?: string;
};

// Social joined types
export type FriendshipWithProfile = Friendship & {
  requester_profile?: UserProfile;
  addressee_profile?: UserProfile;
};

export type SharedTastingWithDetails = SharedTasting & {
  user_profile: UserProfile | null;
  rating: Rating & {
    inventory?: CellarInventory & {
      wine_reference: WineReference | null;
    };
    wine_reference?: WineReference | null;
  };
  likes_count: number;
  comments_count: number;
  has_liked: boolean;
  comments?: (TastingComment & { user_profile: UserProfile | null })[];
};
