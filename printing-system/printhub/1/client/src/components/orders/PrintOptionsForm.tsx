import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PrintOptions } from "@/types";

export function PrintOptionsForm({
  value,
  onChange,
}: {
  value: PrintOptions;
  onChange: (v: PrintOptions) => void;
}) {
  const v = value;
  const set = <K extends keyof PrintOptions>(k: K, val: PrintOptions[K]) =>
    onChange({ ...v, [k]: val });

  const setPaperType = (paperType: PrintOptions["paperType"]) => {
    if (paperType === "normal") {
      // Normal paper only comes in A4.
      onChange({ ...v, paperType, paperSize: "A4" });
    } else {
      // Photo paper is always colour print.
      onChange({ ...v, paperType, type: "color" });
    }
  };

  const setPaperSize = (paperSize: PrintOptions["paperSize"]) => {
    if (paperSize === "4x6") {
      // 4x6 is photo-paper only, and photo paper is always colour.
      onChange({ ...v, paperSize, paperType: "photo", type: "color" });
    } else {
      onChange({ ...v, paperSize });
    }
  };

  const isPhoto = v.paperType === "photo";

  return (
    <div className="grid gap-5">
      <Card>
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Print Type</Label>
            <RadioGroup
              value={v.type}
              onValueChange={(val) => set("type", val as PrintOptions["type"])}
              className="grid grid-cols-2 gap-2"
            >
              <RadioCard id="pt-bw" value="bw" label="Black & White" disabled={isPhoto} />
              <RadioCard id="pt-color" value="color" label="Color" disabled={isPhoto} />
            </RadioGroup>
            {isPhoto && (
              <p className="text-xs text-muted-foreground">Photo paper is always printed in color.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Print Side</Label>
            <RadioGroup
              value={v.side}
              onValueChange={(val) => set("side", val as PrintOptions["side"])}
              className="grid grid-cols-2 gap-2"
            >
              <RadioCard id="ps-single" value="single" label="Single-sided" />
              <RadioCard id="ps-double" value="double" label="Double-sided" />
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="copies">Copies</Label>
            <Input
              id="copies"
              type="number"
              min={1}
              max={500}
              value={v.copies}
              onChange={(e) => set("copies", Math.max(1, parseInt(e.target.value || "1", 10)))}
            />
          </div>
          <div className="space-y-2">
            <Label>Paper Type</Label>
            <Select value={v.paperType} onValueChange={(val) => setPaperType(val as PrintOptions["paperType"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal Paper</SelectItem>
                <SelectItem value="photo">Photo Paper</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Paper Size</Label>
            <Select value={v.paperSize} onValueChange={(val) => setPaperSize(val as PrintOptions["paperSize"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                {isPhoto && <SelectItem value="4x6">4x6 (Passport Photo)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <Label>Pages</Label>
            <RadioGroup
              value={v.pages.mode}
              onValueChange={(val) =>
                set("pages", { mode: val as "all" | "custom", range: v.pages.range })
              }
              className="grid grid-cols-2 gap-2"
            >
              <RadioCard id="pg-all" value="all" label="All Pages" />
              <RadioCard id="pg-custom" value="custom" label="Custom Range" />
            </RadioGroup>
            {v.pages.mode === "custom" && (
              <Input
                placeholder="e.g. 1-40, 45, 50-52"
                value={v.pages.range ?? ""}
                onChange={(e) => set("pages", { mode: "custom", range: e.target.value })}
                aria-label="Custom page range"
              />
            )}
          </div>

          {!isPhoto && (
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckboxField
                id="front-cover"
                label="Front Cover in Color"
                checked={v.frontCoverColor}
                onCheckedChange={(c) => set("frontCoverColor", c)}
              />
              <CheckboxField
                id="back-cover"
                label="Back Cover in Color"
                checked={v.backCoverColor}
                onCheckedChange={(c) => set("backCoverColor", c)}
              />
              <CheckboxField
                id="remove-blank"
                label="Remove Blank Pages"
                checked={v.removeBlankPages}
                onCheckedChange={(c) => set("removeBlankPages", c)}
                className="sm:col-span-2"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RadioCard({
  id,
  value,
  label,
  disabled,
}: {
  id: string;
  value: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onCheckedChange,
  className,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (c: boolean) => void;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium ${className ?? ""}`}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onCheckedChange(Boolean(c))} />
      <span>{label}</span>
    </label>
  );
}
