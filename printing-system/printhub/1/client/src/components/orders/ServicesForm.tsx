import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { BindingOptions, LaminationItem, LaminationType } from "@/types";

const LAM_LABELS: Record<LaminationType, string> = {
  id_card: "ID Card",
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  certificate: "Certificate",
  a4: "A4 Document",
};

export function ServicesForm({
  laminationEnabled,
  onLaminationEnabledChange,
  lamination,
  onLaminationChange,
  binding,
  onBindingChange,
}: {
  laminationEnabled: boolean;
  onLaminationEnabledChange: (v: boolean) => void;
  lamination: LaminationItem[];
  onLaminationChange: (items: LaminationItem[]) => void;
  binding: BindingOptions;
  onBindingChange: (b: BindingOptions) => void;
}) {
  return (
    <div className="grid gap-5">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base">Lamination</Label>
              <p className="text-xs text-muted-foreground">Protect important documents with high-quality lamination.</p>
            </div>
            <Switch checked={laminationEnabled} onCheckedChange={onLaminationEnabledChange} />
          </div>
          {laminationEnabled && (
            <div className="space-y-2">
              {lamination.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <Select
                    value={item.type}
                    onValueChange={(val) => {
                      const next = [...lamination];
                      next[idx] = { ...item, type: val as LaminationType };
                      onLaminationChange(next);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LAM_LABELS) as LaminationType[]).map((t) => (
                        <SelectItem key={t} value={t}>{LAM_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...lamination];
                      next[idx] = { ...item, quantity: Math.max(1, parseInt(e.target.value || "1", 10)) };
                      onLaminationChange(next);
                    }}
                    aria-label="Quantity"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove"
                    onClick={() => onLaminationChange(lamination.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onLaminationChange([...lamination, { type: "id_card", quantity: 1 }])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add lamination item
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <Label className="text-base">Spiral Binding</Label>
            <p className="text-xs text-muted-foreground">Choose how you'd like binding handled for this order.</p>
          </div>
          <RadioGroup
            value={binding.mode}
            onValueChange={(val) =>
              onBindingChange({ ...binding, mode: val as BindingOptions["mode"] })
            }
            className="grid gap-2 sm:grid-cols-3"
          >
            <RadioRow id="b-print" value="print_only" label="Print Only" />
            <RadioRow id="b-both" value="print_and_binding" label="Print + Spiral Binding" />
            <RadioRow id="b-only" value="binding_only" label="Spiral Binding Only" />
          </RadioGroup>

          {binding.mode === "binding_only" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-count">Number of Documents</Label>
                  <Input
                    id="doc-count"
                    type="number"
                    min={1}
                    value={binding.documentCount ?? 1}
                    onChange={(e) =>
                      onBindingChange({ ...binding, documentCount: Math.max(1, parseInt(e.target.value || "1", 10)) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="est-pages">Estimated Pages</Label>
                  <Input
                    id="est-pages"
                    type="number"
                    min={1}
                    value={binding.estimatedPages ?? 0}
                    onChange={(e) =>
                      onBindingChange({ ...binding, estimatedPages: Math.max(0, parseInt(e.target.value || "0", 10)) })
                    }
                  />
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Customer will bring printed pages to the shop for binding.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RadioRow({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary"
    >
      <RadioGroupItem id={id} value={value} />
      <span>{label}</span>
    </label>
  );
}
