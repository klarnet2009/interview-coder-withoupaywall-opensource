/// <reference types="vitest/globals" />

import { describe, expect, it, vi } from "vitest";

vi.mock("electron-log", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import {
  DEFAULT_ANSWER_STYLE,
  DEFAULT_INTERVIEW_MODE,
  MODE_BLOCKS,
  STYLE_BLOCKS,
  modeBlockFor,
  styleBlockFor
} from "../../electron/audio/hintPrompt";
import type { AnswerStyleKey } from "../../electron/audio/hintPrompt";
import { HintGenerationService } from "../../electron/audio/HintGenerationService";

const ECHO = STYLE_BLOCKS.echo;
const ALL_STYLES = Object.keys(STYLE_BLOCKS) as AnswerStyleKey[];
const NON_ECHO_STYLES = ALL_STYLES.filter((style) => style !== "echo");

/**
 * Phrasings that tell the model to hold the answer back. `hints` is the only
 * style allowed to use them: `full` and `echo` exist to hand the candidate
 * something usable, so a withholding rule in their prompt is a bug - and a
 * global one, applying to every style at once, was removed once already.
 */
const WITHHOLDING_PATTERNS: RegExp[] = [
  /do\s*n[o']?t\s+give\s+(?:away|the\s+actual)/i,
  /withhold/i,
  /only\s+hints/i,
  /guide\s+the\s+candidate/i,
  /don'?t\s+give\s+away\s+complete\s+solutions/i
];

/** Depth rules that used to sit in the global role list, outside the style block. */
const GLOBAL_DEPTH_PATTERNS: RegExp[] = [
  /be\s+brief/i,
  /pseudocode\s+or\s+key\s+concepts\s+only/i,
  /provide\s+concise,\s+helpful\s+hints/i
];

function assembledPrompt(style: string, mode: string = "coding"): string {
  return new HintGenerationService("test-key", undefined, "en", mode, style).getSystemInstruction();
}

/**
 * The assembled prompt with the style block cut out - everything that speaks to
 * the model regardless of the style the user picked.
 */
function promptScaffolding(style: string, mode: string = "coding"): string {
  const block = styleBlockFor(style);
  const prompt = assembledPrompt(style, mode);
  expect(prompt).toContain(block);
  return prompt.split(block).join("");
}

describe("STYLE_BLOCKS.echo - voice", () => {
  it("speaks in first person", () => {
    expect(ECHO).toMatch(/first person/i);
  });

  it("says the answer is read out loud, word for word", () => {
    expect(ECHO).toMatch(/out loud/i);
    expect(ECHO).toMatch(/word for word/i);
  });

  it("rules out every shape the spoken-style check rejects", () => {
    expect(ECHO).toMatch(/no bullet points/i);
    expect(ECHO).toMatch(/no headings/i);
    expect(ECHO).toMatch(/no code blocks/i);
    expect(ECHO).toMatch(/no stage directions/i);
  });

  it("keeps the three-to-six sentence budget", () => {
    expect(ECHO).toMatch(/three to six sentences/i);
  });

  it("reaches the model whole, inside the assembled prompt", () => {
    const prompt = assembledPrompt("echo");
    expect(prompt).toContain(ECHO);
    expect(prompt).toMatch(/== ANSWER STYLE ==/);
  });
});

describe("STYLE_BLOCKS.echo - hesitation that sounds human", () => {
  it("permits speaking abstractly before getting precise", () => {
    expect(ECHO).toMatch(/rough, abstract terms before you get precise/i);
  });

  it("permits hedging and admitting ignorance", () => {
    expect(ECHO).toMatch(/hedge/i);
    expect(ECHO).toMatch(/you don't know/i);
  });

  it("permits a self-correction and an unfinished closing thought", () => {
    expect(ECHO).toMatch(/correct yourself once mid-sentence/i);
    expect(ECHO).toMatch(/trail off/i);
  });

  it("caps the hesitation so it cannot turn into filler", () => {
    expect(ECHO).toMatch(/one or two of these per answer, never more/i);
    expect(ECHO).toMatch(/three in a row/i);
  });

  it("ties the hedging to real uncertainty rather than to the main claim", () => {
    expect(ECHO).toMatch(/substance still has to be right/i);
    expect(ECHO).toMatch(/never the main claim/i);
    expect(ECHO).toMatch(/never manufacture doubt/i);
  });

  it("keeps the sentence that carries the answer intact", () => {
    expect(ECHO).toMatch(/carries the answer whole/i);
    expect(ECHO).toMatch(/aside, never the point/i);
  });

  it("bans stacked fillers", () => {
    expect(ECHO).toMatch(/no stacked fillers/i);
  });

  it("keeps the hesitation in the language being spoken", () => {
    expect(ECHO).toMatch(/in the language you are speaking, not in English/i);
  });

  it.each(NON_ECHO_STYLES)("does not leak the hesitation licence into %s", (style) => {
    expect(STYLE_BLOCKS[style]).not.toMatch(/hedge|trail off|correct yourself|hesitation/i);
  });
});

describe("withholding lives in `hints` and nowhere else", () => {
  it("has a live pattern set - `hints` is caught by it", () => {
    const caught = WITHHOLDING_PATTERNS.filter((pattern) => pattern.test(STYLE_BLOCKS.hints));
    expect(caught.length).toBeGreaterThan(0);
  });

  it.each(["full", "echo"] as const)("never tells %s to withhold", (style) => {
    for (const pattern of WITHHOLDING_PATTERNS) {
      expect(STYLE_BLOCKS[style]).not.toMatch(pattern);
    }
  });

  it.each(ALL_STYLES)("keeps withholding out of the scaffolding around %s", (style) => {
    const scaffolding = promptScaffolding(style);
    for (const pattern of WITHHOLDING_PATTERNS) {
      expect(scaffolding).not.toMatch(pattern);
    }
  });
});

describe("depth is decided by exactly one section", () => {
  it.each(ALL_STYLES)("adds no global depth rule alongside %s", (style) => {
    const scaffolding = promptScaffolding(style);
    for (const pattern of GLOBAL_DEPTH_PATTERNS) {
      expect(scaffolding).not.toMatch(pattern);
    }
  });

  it("still carries the rules that are not about depth or voice", () => {
    const scaffolding = promptScaffolding("echo");
    expect(scaffolding).toMatch(/SAME LANGUAGE as the interviewer's question/);
    expect(scaffolding).toMatch(/full context of the interview so far/);
  });

  it("survives profile injection without picking up a depth rule", () => {
    const withProfile = new HintGenerationService(
      "test-key",
      undefined,
      "en",
      "coding",
      "echo",
      { name: "Test", targetRole: "Backend Engineer" }
    ).getSystemInstruction();
    expect(withProfile).toContain(ECHO);
    for (const pattern of [...WITHHOLDING_PATTERNS, ...GLOBAL_DEPTH_PATTERNS]) {
      expect(withProfile.split(ECHO).join("")).not.toMatch(pattern);
    }
  });
});

describe("style and mode resolution", () => {
  it.each(ALL_STYLES)("resolves %s to its own non-empty block", (style) => {
    expect(styleBlockFor(style)).toBe(STYLE_BLOCKS[style]);
    expect(STYLE_BLOCKS[style].trim().length).toBeGreaterThan(0);
  });

  it.each(["custom", "nonsense", "", undefined, null])(
    "falls back to the default style for %p",
    (style) => {
      expect(styleBlockFor(style)).toBe(STYLE_BLOCKS[DEFAULT_ANSWER_STYLE]);
    }
  );

  it("does not resolve inherited object properties as styles", () => {
    expect(styleBlockFor("toString")).toBe(STYLE_BLOCKS[DEFAULT_ANSWER_STYLE]);
  });

  it("treats behavioral and general as the same interview mode", () => {
    expect(modeBlockFor("behavioral")).toBe(modeBlockFor("general"));
  });

  it("keeps system design distinct and falls back to coding", () => {
    expect(modeBlockFor("system_design")).toMatch(/system design/i);
    expect(modeBlockFor("nonsense")).toBe(MODE_BLOCKS[DEFAULT_INTERVIEW_MODE]);
    expect(modeBlockFor(undefined)).toBe(MODE_BLOCKS[DEFAULT_INTERVIEW_MODE]);
  });
});
