"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  BodyLevel,
  TanninLevel,
  AcidityLevel,
  SweetnessLevel,
  FinishLength,
  IntensityLevel,
  QualityLevel,
} from "@/types/database";

interface CharacteristicSelectorProps<T extends string> {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | null) => void;
  description?: string;
}

function CharacteristicSelector<T extends string>({
  label,
  value,
  options,
  onChange,
  description,
}: CharacteristicSelectorProps<T>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(value === option.value ? null : option.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              value === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const BODY_OPTIONS = [
  { value: "light" as const, label: "Light" },
  { value: "medium-light" as const, label: "Medium-Light" },
  { value: "medium" as const, label: "Medium" },
  { value: "medium-full" as const, label: "Medium-Full" },
  { value: "full" as const, label: "Full" },
] as const;

const TANNIN_OPTIONS = [
  { value: "none" as const, label: "None" },
  { value: "low" as const, label: "Low" },
  { value: "medium-low" as const, label: "Medium-Low" },
  { value: "medium" as const, label: "Medium" },
  { value: "medium-high" as const, label: "Medium-High" },
  { value: "high" as const, label: "High" },
] as const;

const ACIDITY_OPTIONS = [
  { value: "low" as const, label: "Low" },
  { value: "medium-low" as const, label: "Medium-Low" },
  { value: "medium" as const, label: "Medium" },
  { value: "medium-high" as const, label: "Medium-High" },
  { value: "high" as const, label: "High" },
] as const;

const SWEETNESS_OPTIONS = [
  { value: "bone-dry" as const, label: "Bone Dry" },
  { value: "dry" as const, label: "Dry" },
  { value: "off-dry" as const, label: "Off-Dry" },
  { value: "medium-sweet" as const, label: "Medium Sweet" },
  { value: "sweet" as const, label: "Sweet" },
] as const;

const FINISH_OPTIONS = [
  { value: "short" as const, label: "Short" },
  { value: "medium" as const, label: "Medium" },
  { value: "long" as const, label: "Long" },
  { value: "very-long" as const, label: "Very Long" },
] as const;

const INTENSITY_OPTIONS = [
  { value: "delicate" as const, label: "Delicate" },
  { value: "moderate" as const, label: "Moderate" },
  { value: "powerful" as const, label: "Powerful" },
] as const;

const QUALITY_OPTIONS = [
  { value: "poor" as const, label: "Poor" },
  { value: "acceptable" as const, label: "Acceptable" },
  { value: "good" as const, label: "Good" },
  { value: "very-good" as const, label: "Very Good" },
  { value: "outstanding" as const, label: "Outstanding" },
  { value: "exceptional" as const, label: "Exceptional" },
] as const;

export interface WineCharacteristicsData {
  body: BodyLevel | null;
  tannins: TanninLevel | null;
  acidity: AcidityLevel | null;
  sweetness: SweetnessLevel | null;
  finish: FinishLength | null;
  intensity: IntensityLevel | null;
  quality_level: QualityLevel | null;
}

interface WineCharacteristicsProps {
  value: WineCharacteristicsData;
  onChange: (value: WineCharacteristicsData) => void;
  wineType?: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null;
  className?: string;
}

export function WineCharacteristics({
  value,
  onChange,
  wineType,
  className,
}: WineCharacteristicsProps) {
  const showTannins = wineType === "red" || wineType === "fortified" || !wineType;

  const updateField = <K extends keyof WineCharacteristicsData>(
    field: K,
    fieldValue: WineCharacteristicsData[K]
  ) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className={cn("space-y-6", className)}>
      <h3 className="font-semibold text-lg">Wine Characteristics</h3>

      <div className="grid gap-6 md:grid-cols-2">
        <CharacteristicSelector
          label="Body"
          value={value.body}
          options={BODY_OPTIONS}
          onChange={(v) => updateField("body", v)}
          description="The weight and fullness of the wine"
        />

        {showTannins && (
          <CharacteristicSelector
            label="Tannins"
            value={value.tannins}
            options={TANNIN_OPTIONS}
            onChange={(v) => updateField("tannins", v)}
            description="The drying, gripping sensation"
          />
        )}

        <CharacteristicSelector
          label="Acidity"
          value={value.acidity}
          options={ACIDITY_OPTIONS}
          onChange={(v) => updateField("acidity", v)}
          description="The tartness and freshness"
        />

        <CharacteristicSelector
          label="Sweetness"
          value={value.sweetness}
          options={SWEETNESS_OPTIONS}
          onChange={(v) => updateField("sweetness", v)}
          description="The perceived sugar level"
        />

        <CharacteristicSelector
          label="Finish"
          value={value.finish}
          options={FINISH_OPTIONS}
          onChange={(v) => updateField("finish", v)}
          description="How long the taste lingers"
        />

        <CharacteristicSelector
          label="Intensity"
          value={value.intensity}
          options={INTENSITY_OPTIONS}
          onChange={(v) => updateField("intensity", v)}
          description="The concentration of flavors"
        />
      </div>

      <CharacteristicSelector
        label="Overall Quality"
        value={value.quality_level}
        options={QUALITY_OPTIONS}
        onChange={(v) => updateField("quality_level", v)}
        description="Your assessment of the wine's quality"
      />
    </div>
  );
}
