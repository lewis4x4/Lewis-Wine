"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCellarLocations, useSimpleLocations } from "@/lib/hooks/use-cellar-locations";
import type { LocationMode, CellarLocation } from "@/types/database";

interface LocationSelectorProps {
  cellarId: string;
  mode: LocationMode;
  value: string | null;
  locationId?: string | null;
  onChange: (value: string | null) => void;
  onLocationIdChange?: (id: string | null) => void;
}

export function LocationSelector({
  cellarId,
  mode,
  value,
  locationId,
  onChange,
  onLocationIdChange,
}: LocationSelectorProps) {
  if (mode === "simple") {
    return (
      <SimpleLocationSelector
        cellarId={cellarId}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (mode === "structured") {
    return (
      <StructuredLocationSelector
        cellarId={cellarId}
        locationId={locationId}
        onLocationIdChange={onLocationIdChange}
      />
    );
  }

  if (mode === "grid") {
    return (
      <GridLocationSelector
        cellarId={cellarId}
        locationId={locationId}
        onLocationIdChange={onLocationIdChange}
      />
    );
  }

  return null;
}

// Simple mode: free-text with autocomplete
function SimpleLocationSelector({
  cellarId,
  value,
  onChange,
}: {
  cellarId: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { data: suggestions = [] } = useSimpleLocations(cellarId);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes((value || "").toLowerCase()) && s !== value
  );

  return (
    <div className="space-y-2">
      <Label htmlFor="location">Storage Location</Label>
      <div className="relative">
        <Input
          id="location"
          placeholder="e.g., Kitchen wine rack, top shelf"
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                onClick={() => {
                  onChange(suggestion);
                  setShowSuggestions(false);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Where is this wine stored in your cellar?
      </p>
    </div>
  );
}

// Structured mode: Zone → Rack → Shelf → Position dropdowns
function StructuredLocationSelector({
  cellarId,
  locationId,
  onLocationIdChange,
}: {
  cellarId: string;
  locationId?: string | null;
  onLocationIdChange?: (id: string | null) => void;
}) {
  const { data: locations = [] } = useCellarLocations(cellarId);

  // Get unique zones, racks, shelves
  const zones = [...new Set(locations.map((l) => l.zone).filter(Boolean))];
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);

  const racksInZone = [
    ...new Set(
      locations
        .filter((l) => l.zone === selectedZone)
        .map((l) => l.rack)
        .filter(Boolean)
    ),
  ];

  const shelvesInRack = [
    ...new Set(
      locations
        .filter((l) => l.zone === selectedZone && l.rack === selectedRack)
        .map((l) => l.shelf)
        .filter(Boolean)
    ),
  ];

  const positionsInShelf = locations.filter(
    (l) =>
      l.zone === selectedZone &&
      l.rack === selectedRack &&
      l.shelf === selectedShelf
  );

  // Find selected location for display
  const selectedLocation = locations.find((l) => l.id === locationId);

  if (locations.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Storage Location</Label>
        <p className="text-sm text-muted-foreground">
          No locations configured. Go to Settings to set up your cellar locations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label>Storage Location</Label>

      {/* Show selected location or selection UI */}
      {selectedLocation ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium">
              {[
                selectedLocation.zone,
                selectedLocation.rack,
                selectedLocation.shelf,
                selectedLocation.position,
              ]
                .filter(Boolean)
                .join(" → ")}
            </p>
            {selectedLocation.name && (
              <p className="text-sm text-muted-foreground">{selectedLocation.name}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onLocationIdChange?.(null);
              setSelectedZone(null);
              setSelectedRack(null);
              setSelectedShelf(null);
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Zone */}
          <Select value={selectedZone || ""} onValueChange={setSelectedZone}>
            <SelectTrigger>
              <SelectValue placeholder="Select zone" />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone!}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Rack */}
          <Select
            value={selectedRack || ""}
            onValueChange={setSelectedRack}
            disabled={!selectedZone}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select rack" />
            </SelectTrigger>
            <SelectContent>
              {racksInZone.map((rack) => (
                <SelectItem key={rack} value={rack!}>
                  {rack}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Shelf */}
          <Select
            value={selectedShelf || ""}
            onValueChange={setSelectedShelf}
            disabled={!selectedRack}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select shelf" />
            </SelectTrigger>
            <SelectContent>
              {shelvesInRack.map((shelf) => (
                <SelectItem key={shelf} value={shelf!}>
                  {shelf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Position */}
          <Select
            value={locationId || ""}
            onValueChange={(id) => onLocationIdChange?.(id)}
            disabled={!selectedShelf}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {positionsInShelf.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.position || loc.name || "Position"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// Grid mode: visual grid selection
function GridLocationSelector({
  cellarId,
  locationId,
  onLocationIdChange,
}: {
  cellarId: string;
  locationId?: string | null;
  onLocationIdChange?: (id: string | null) => void;
}) {
  const { data: locations = [] } = useCellarLocations(cellarId);

  // Find selected location
  const selectedLocation = locations.find((l) => l.id === locationId);

  if (locations.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Storage Location</Label>
        <p className="text-sm text-muted-foreground">
          No grid locations configured. Go to Settings to set up your cellar grid.
        </p>
      </div>
    );
  }

  // Group by rack (row) and shelf (column) for grid display
  const racks = [...new Set(locations.map((l) => l.rack).filter(Boolean))].sort();
  const shelves = [...new Set(locations.map((l) => l.shelf).filter(Boolean))].sort();

  return (
    <div className="space-y-3">
      <Label>Storage Location</Label>

      {selectedLocation ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium">
              {selectedLocation.name || `${selectedLocation.rack}-${selectedLocation.shelf}`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onLocationIdChange?.(null)}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg p-4 overflow-x-auto">
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(${shelves.length}, 40px)` }}>
            {/* Header row */}
            <div className="w-12" />
            {shelves.map((shelf) => (
              <div key={shelf} className="text-center text-xs font-medium text-muted-foreground">
                {shelf}
              </div>
            ))}

            {/* Grid rows */}
            {racks.map((rack) => (
              <>
                <div key={`label-${rack}`} className="text-xs font-medium text-muted-foreground flex items-center">
                  {rack}
                </div>
                {shelves.map((shelf) => {
                  const loc = locations.find((l) => l.rack === rack && l.shelf === shelf);
                  const isSelected = loc?.id === locationId;

                  return (
                    <button
                      key={`${rack}-${shelf}`}
                      type="button"
                      className={`w-10 h-10 rounded border-2 transition-colors ${
                        loc
                          ? isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-gray-100 border-gray-200 hover:border-primary hover:bg-gray-50"
                          : "bg-gray-50 border-dashed border-gray-200 cursor-not-allowed"
                      }`}
                      disabled={!loc}
                      onClick={() => loc && onLocationIdChange?.(loc.id)}
                    >
                      {loc && (
                        <span className="text-xs">
                          {isSelected ? "✓" : ""}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Click a cell to select a storage location
      </p>
    </div>
  );
}
