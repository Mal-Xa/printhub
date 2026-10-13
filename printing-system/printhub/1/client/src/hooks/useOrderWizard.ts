import { useEffect, useState } from "react";
import type {
  BindingOptions,
  LaminationItem,
  PrintOptions,
} from "@/types";
import type { DroppedFile } from "@/components/orders/FileDropzone";

export interface WizardState {
  files: DroppedFile[];
  printOptions: PrintOptions;
  lamination: LaminationItem[];
  laminationEnabled: boolean;
  binding: BindingOptions;
  specialInstructions: string;
}

const KEY = "sora.wizard";

export const defaultWizardState: WizardState = {
  files: [],
  printOptions: {
    type: "bw",
    side: "double",
    copies: 1,
    paperSize: "A4",
    paperType: "normal",
    pages: { mode: "all" },
    frontCoverColor: false,
    backCoverColor: false,
    removeBlankPages: false,
  },
  lamination: [{ type: "id_card", quantity: 1 }],
  laminationEnabled: false,
  binding: { mode: "print_only" },
  specialInstructions: "",
};

export function useOrderWizard() {
  const [state, setState] = useState<WizardState>(defaultWizardState);
  const [step, setStep] = useState(1);

  // hydrate
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: WizardState; step?: number };
        if (parsed.state) setState({ ...defaultWizardState, ...parsed.state, files: [] });
        if (parsed.step) setStep(parsed.step);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // persist (files are skipped to avoid serializing File objects)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { files: _f, ...rest } = state;
    void _f;
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: rest, step }));
  }, [state, step]);

  const update = (patch: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const reset = () => {
    setState(defaultWizardState);
    setStep(1);
    if (typeof window !== "undefined") window.sessionStorage.removeItem(KEY);
  };

  return { state, setState, update, step, setStep, reset };
}
