import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCustomReportPreset } from "./reportPresets";
import { loadCustomTemplates, saveCustomTemplates } from "./customTemplates";

const storage = new Map<string, string>();

vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
});

afterEach(() => {
  storage.clear();
});

describe("custom templates", () => {
  it("saves and loads custom templates", () => {
    const template = {
      ...defaultCustomReportPreset,
      id: "template_1",
      name: "Saturday simulation",
      createdAt: "2026-05-04T12:00:00.000Z",
      raceFormat: "custom" as const,
    };

    saveCustomTemplates([template]);

    expect(loadCustomTemplates()).toEqual([template]);
  });
});
