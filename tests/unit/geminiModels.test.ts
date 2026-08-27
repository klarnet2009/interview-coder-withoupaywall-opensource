/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import {
  GEMINI_MODELS,
  GEMINI_MODEL_IDS,
  GEMINI_SELECTABLE_MODELS,
  isKnownGeminiModel,
  resolveGeminiModelId
} from "../../electron/constants/geminiModels";
import { DEFAULT_CONFIG } from "../../src/types";

describe("resolveGeminiModelId", () => {
  it("remaps the retired gemini-3-flash-preview id to the current default", () => {
    expect(resolveGeminiModelId("gemini-3-flash-preview")).toBe(GEMINI_MODELS.DEFAULT);
  });

  it("remaps the retired gemini-3-pro-preview id to the current pro model", () => {
    expect(resolveGeminiModelId("gemini-3-pro-preview")).toBe("gemini-3.1-pro");
  });

  it("remaps the 2.0-era flash id forward", () => {
    expect(resolveGeminiModelId("gemini-2.0-flash")).toBe("gemini-3.6-flash");
  });

  it("remaps the 1.5 and 2.0 pro-era ids to the current pro model", () => {
    expect(resolveGeminiModelId("gemini-1.5-pro")).toBe("gemini-3.1-pro");
    expect(resolveGeminiModelId("gemini-2.0-pro-exp-02-05")).toBe("gemini-3.1-pro");
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
    expect(resolveGeminiModelId("  gemini-3.1-pro  ")).toBe("gemini-3.1-pro");
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
});

describe("DEFAULT_CONFIG cross-boundary import", () => {
  it("sources renderer default models from the shared constants module", () => {
    expect(DEFAULT_CONFIG.extractionModel).toBe(GEMINI_MODELS.EXTRACTION);
    expect(DEFAULT_CONFIG.solutionModel).toBe(GEMINI_MODELS.SOLUTION);
    expect(DEFAULT_CONFIG.debuggingModel).toBe(GEMINI_MODELS.DEBUG);
  });
});
