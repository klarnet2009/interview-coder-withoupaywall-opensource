/// <reference types="vitest/globals" />

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GEMINI_MODELS,
  GEMINI_MODEL_IDS,
  GEMINI_SELECTABLE_MODELS,
  LEGACY_GEMINI_MODEL_MAP,
  isKnownGeminiModel,
  resolveGeminiModelId
} from "../../electron/constants/geminiModels";
import {
  LEGACY_GEMINI_MODEL_MAP as BACKEND_LEGACY_GEMINI_MODEL_MAP,
  resolveGeminiModelId as backendResolveGeminiModelId
} from "../../backend/src/processing/providers/gemini.models";
import { DEFAULT_CONFIG } from "../../src/types";

/**
 * The Pro id confirmed to exist on the live API by a real generateContent call.
 * Every pro-era legacy remap must land here.
 */
const PRO_MODEL_ID = "gemini-3.1-pro-preview";

describe("resolveGeminiModelId", () => {
  it("remaps the retired gemini-3-flash-preview id to the current default", () => {
    expect(resolveGeminiModelId("gemini-3-flash-preview")).toBe(GEMINI_MODELS.DEFAULT);
  });

  it("remaps the retired gemini-3-pro-preview id to the current pro model", () => {
    expect(resolveGeminiModelId("gemini-3-pro-preview")).toBe(PRO_MODEL_ID);
  });

  it("remaps the 2.0-era flash id forward", () => {
    expect(resolveGeminiModelId("gemini-2.0-flash")).toBe("gemini-3.6-flash");
  });

  it("remaps the 1.5 and 2.0 pro-era ids to the current pro model", () => {
    expect(resolveGeminiModelId("gemini-1.5-pro")).toBe(PRO_MODEL_ID);
    expect(resolveGeminiModelId("gemini-2.0-pro-exp-02-05")).toBe(PRO_MODEL_ID);
  });

  it("rescues the suffix-less pro id the picker itself offered before it was corrected", () => {
    // Built by suffix removal, never written as a literal: the source-scan gate below
    // treats any occurrence of this string under electron/, src/ or backend/src/ as a
    // failure, and this test file lives outside all three roots.
    const retiredProId = PRO_MODEL_ID.replace("-preview", "");
    expect(resolveGeminiModelId(retiredProId)).toBe(PRO_MODEL_ID);
  });

  it("falls back to the default for empty and whitespace-only input", () => {
    expect(resolveGeminiModelId("")).toBe(GEMINI_MODELS.DEFAULT);
    expect(resolveGeminiModelId("   ")).toBe(GEMINI_MODELS.DEFAULT);
  });

  it("falls back to the default for null and undefined", () => {
    expect(resolveGeminiModelId(null)).toBe(GEMINI_MODELS.DEFAULT);
    expect(resolveGeminiModelId(undefined)).toBe(GEMINI_MODELS.DEFAULT);
  });

  it("rejects a path-traversal shaped id before it can reach a URL path segment", () => {
    expect(resolveGeminiModelId("../../v1beta/models/x")).toBe(GEMINI_MODELS.DEFAULT);
  });

  it("passes unknown-but-safe ids through unchanged so Custom Model keeps working", () => {
    expect(resolveGeminiModelId("some-fine-tuned-model-1")).toBe("some-fine-tuned-model-1");
  });

  it("trims surrounding whitespace from an otherwise valid id", () => {
    expect(resolveGeminiModelId(`  ${PRO_MODEL_ID}  `)).toBe(PRO_MODEL_ID);
  });
});

describe("LEGACY_GEMINI_MODEL_MAP invariants", () => {
  /**
   * The property that was violated in spirit by the dead pro id: a remap target that
   * nothing else in the app vouches for. Whoever next rotates the picker id cannot
   * leave the map pointing at a value the app no longer offers.
   */
  it("only ever remaps forward onto an id the app itself offers or defaults to", () => {
    const vouchedFor = new Set<string>([
      ...GEMINI_MODEL_IDS,
      ...Object.values(GEMINI_MODELS)
    ]);

    for (const [legacyId, target] of Object.entries(LEGACY_GEMINI_MODEL_MAP)) {
      expect(
        vouchedFor.has(target),
        `${legacyId} remaps to ${target}, which is neither selectable nor a role default`
      ).toBe(true);
    }
  });

  it("never remaps an id the picker currently offers", () => {
    for (const id of GEMINI_MODEL_IDS) {
      expect(LEGACY_GEMINI_MODEL_MAP[id]).toBeUndefined();
    }
  });
});

describe("desktop/backend legacy map parity", () => {
  /**
   * Both file headers have warned that the two copies must be updated together since
   * the duplicate was introduced. This is the gate that finally backs the warning.
   */
  it("declares the identical legacy key set on both sides of the repo boundary", () => {
    expect(Object.keys(BACKEND_LEGACY_GEMINI_MODEL_MAP).sort()).toEqual(
      Object.keys(LEGACY_GEMINI_MODEL_MAP).sort()
    );
  });

  it("resolves every legacy key to the same id in the desktop app and the backend", () => {
    for (const legacyId of Object.keys(LEGACY_GEMINI_MODEL_MAP)) {
      expect(backendResolveGeminiModelId(legacyId)).toBe(resolveGeminiModelId(legacyId));
    }
  });

  it("agrees on the fallback default", () => {
    expect(backendResolveGeminiModelId("")).toBe(resolveGeminiModelId(""));
    expect(backendResolveGeminiModelId(null)).toBe(resolveGeminiModelId(null));
  });
});

describe("non-existent model ids are absent from every shipped source root", () => {
  const REPO_ROOT = join(__dirname, "..", "..");
  const SCAN_ROOTS = ["electron", "src", join("backend", "src")];
  const SKIP_DIRS = new Set(["node_modules", "dist", "dist-electron"]);

  function collectSourceFiles(dir: string, out: string[]): string[] {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        collectSourceFiles(full, out);
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        out.push(full);
      }
    }
    return out;
  }

  const sourceFiles = SCAN_ROOTS.flatMap((root) =>
    collectSourceFiles(join(REPO_ROOT, root), [])
  );

  function scanFor(needle: RegExp): string[] {
    return sourceFiles
      .filter((file) => needle.test(readFileSync(file, "utf8")))
      .map((file) => relative(REPO_ROOT, file));
  }

  it("scans a non-trivial number of files, so a passing scan means something", () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  it("never mentions the suffix-less pro id, comments included", () => {
    // Negative lookahead, not a substring search: the retired id is a strict prefix of
    // the correct one, so `includes` would report every correct usage as a violation.
    expect(scanFor(/gemini-3\.1-pro(?!-preview)/)).toEqual([]);
  });

  it("never mentions the native-audio Live id that does not exist on the API", () => {
    expect(scanFor(/gemini-live-2\.5-flash-native-audio/)).toEqual([]);
  });
});

describe("GEMINI_SELECTABLE_MODELS", () => {
  it("offers only ids that are not themselves legacy", () => {
    for (const model of GEMINI_SELECTABLE_MODELS) {
      expect(resolveGeminiModelId(model.id)).toBe(model.id);
    }
  });

  it("derives GEMINI_MODEL_IDS from the selectable list", () => {
    expect(GEMINI_MODEL_IDS).toEqual(GEMINI_SELECTABLE_MODELS.map((model) => model.id));
  });

  it("reports membership for selectable ids only", () => {
    expect(isKnownGeminiModel(GEMINI_MODELS.DEFAULT)).toBe(true);
    expect(isKnownGeminiModel("some-fine-tuned-model-1")).toBe(false);
  });

  it("offers the pro tier under the preview id that was confirmed to exist", () => {
    const pro = GEMINI_SELECTABLE_MODELS.find((model) => model.id.includes("pro"));
    expect(pro).toBeDefined();
    expect(pro?.id).toBe(PRO_MODEL_ID);
    // The picker value is persisted to config.json and used for months, so the user is
    // entitled to see that the id has a retirement date.
    expect(pro?.name).toBe("Gemini 3.1 Pro (Preview)");
  });
});

describe("DEFAULT_CONFIG cross-boundary import", () => {
  it("sources renderer default models from the shared constants module", () => {
    expect(DEFAULT_CONFIG.extractionModel).toBe(GEMINI_MODELS.EXTRACTION);
    expect(DEFAULT_CONFIG.solutionModel).toBe(GEMINI_MODELS.SOLUTION);
    expect(DEFAULT_CONFIG.debuggingModel).toBe(GEMINI_MODELS.DEBUG);
  });
});
