/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { SavedSnippet } from "../../src/types";
import { restoreSnippetWorkspace } from "../../src/lib/sessionRestore";

describe("restoreSnippetWorkspace", () => {
  it("restores debug workspace payload with explicit values", () => {
    const snippet: SavedSnippet = {
      id: "1",
      question: "Why does this fail?",
      answer: "Because index is out of bounds.",
      timestamp: Date.now(),
      tags: ["debug"],
      workspace: {
        type: "debug",
        code: "const x = arr[i]",
        keyPoints: ["check bounds"],
        timeComplexity: "O(n)",
        spaceComplexity: "O(1)",
        issues: ["index overflow"],
        fixes: ["guard i < arr.length"],
        why: ["prevents runtime crash"],
        verify: ["test i == arr.length"]
      }
    };

    const restored = restoreSnippetWorkspace(snippet);
    expect(restored.target).toBe("debug");
    if (restored.target === "debug") {
      expect(restored.payload.code).toBe("const x = arr[i]");
      expect(restored.payload.debug_analysis).toBe(
        "Because index is out of bounds."
      );
      expect(restored.payload.time_complexity).toBe("O(n)");
      expect(restored.payload.space_complexity).toBe("O(1)");
      expect(restored.payload.next_steps).toEqual(["test i == arr.length"]);
    }
  });

  it("restores debug workspace payload with safe defaults", () => {
    const snippet: SavedSnippet = {
      id: "2",
      question: "Find bug",
      answer: "NPE due to missing null check",
      timestamp: Date.now(),
      tags: ["debug"],
      workspace: {
        type: "debug"
      }
    };

    const restored = restoreSnippetWorkspace(snippet);
    expect(restored.target).toBe("debug");
    if (restored.target === "debug") {
      expect(restored.payload.code).toBe("NPE due to missing null check");
      expect(restored.payload.thoughts).toEqual(["Find bug"]);
      expect(restored.payload.issues).toEqual([]);
      expect(restored.payload.fixes).toEqual([]);
      expect(restored.payload.time_complexity).toBe("N/A - Debug mode");
      expect(restored.payload.space_complexity).toBe("N/A - Debug mode");
    }
  });

  it("restores solution workspace payload when workspace type is solution", () => {
    const snippet: SavedSnippet = {
      id: "3",
      question: "Two sum",
      answer: "Use a hash map.",
      timestamp: Date.now(),
      tags: ["solution"],
      workspace: {
        type: "solution",
        code: "function twoSum() {}",
        keyPoints: ["map values to indices"],
        timeComplexity: "O(n)",
        spaceComplexity: "O(n)"
      }
    };

    const restored = restoreSnippetWorkspace(snippet);
    expect(restored.target).toBe("solution");
    if (restored.target === "solution") {
      expect(restored.payload.code).toBe("function twoSum() {}");
      expect(restored.payload.thoughts).toEqual(["map values to indices"]);
      expect(restored.payload.time_complexity).toBe("O(n)");
      expect(restored.payload.space_complexity).toBe("O(n)");
    }
  });

  it("falls back to solution payload when workspace is missing", () => {
    const snippet: SavedSnippet = {
      id: "4",
      question: "What is memoization?",
      answer: "Cache repeated subproblems.",
      timestamp: Date.now(),
      tags: ["solution"]
    };

    const restored = restoreSnippetWorkspace(snippet);
    expect(restored.target).toBe("solution");
    if (restored.target === "solution") {
      expect(restored.payload.code).toBe("Cache repeated subproblems.");
      expect(restored.payload.thoughts).toEqual(["What is memoization?"]);
      expect(restored.payload.time_complexity).toBe(
        "Loaded from session history"
      );
      expect(restored.payload.space_complexity).toBe(
        "Loaded from session history"
      );
    }
  });
});
