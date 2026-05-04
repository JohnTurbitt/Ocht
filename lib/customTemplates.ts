import { ReportPreset } from "./reportPresets";

export type CustomTemplate = ReportPreset & {
  id: string;
  name: string;
  createdAt: string;
  raceFormat: "custom";
};

const storageKey = "reprun.customTemplates";

export function loadCustomTemplates(): CustomTemplate[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawTemplates = window.localStorage.getItem(storageKey);

    if (!rawTemplates) {
      return [];
    }

    const templates = JSON.parse(rawTemplates);

    if (!Array.isArray(templates)) {
      return [];
    }

    return templates.filter((template) => template.raceFormat === "custom");
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: CustomTemplate[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(templates));
}
