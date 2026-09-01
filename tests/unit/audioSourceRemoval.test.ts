/**
 * Standing gate for the removal of per-application audio capture.
 *
 * On Windows the window id handed to `chromeMediaSource: "desktop"` has no effect on
 * the audio track — the capture is whole-system loopback regardless. The option
 * therefore named one application while shipping the user's entire desktop, mid
 * interview, to Google's Live API. That false label is what justified removing it
 * rather than warning about it, and this file is what stops it coming back.
 *
 * Every source assertion below is scoped to the declaration region it is about, never
 * to a whole file: the rationale comments at the removal sites necessarily mention the
 * removed concept by name, and a whole-file substring scan would fail on the very
 * explanation that keeps the removal from being undone.
 */
/// <reference types="vitest/globals" />

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIO_SOURCE_IDS,
  normalizeAudioSource
} from "../../electron/constants/audioSource";
import { toRuntimeAudioSource } from "../../src/components/UnifiedPanel/constants";

const REPO_ROOT = join(__dirname, "..", "..");
const REMOVED_SOURCE = "application";

const read = (relativePath: string): string =>
  readFileSync(join(REPO_ROOT, relativePath), "utf8");

/**
 * Line-ending agnostic on purpose: this tree carries mixed CRLF and LF, sometimes
 * inside a single file.
 */
const stripLineComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

describe("normalizeAudioSource", () => {
  it("passes the two surviving sources through unchanged", () => {
    expect(normalizeAudioSource("microphone")).toBe("microphone");
    expect(normalizeAudioSource("system")).toBe("system");
  });

  it("migrates a persisted per-application selection to system audio", () => {
    // Every config.json already in the wild that names an application lands here.
    // The captured content is what the user was already receiving; the acquisition
    // path is not — see the module header for the cost this migration accepts.
    expect(normalizeAudioSource(REMOVED_SOURCE)).toBe("system");
  });

  it("falls back to system for absent, wrongly-typed and unknown values", () => {
    expect(normalizeAudioSource(undefined)).toBe("system");
    expect(normalizeAudioSource(null)).toBe("system");
    expect(normalizeAudioSource(42)).toBe("system");
    expect(normalizeAudioSource("nonsense")).toBe("system");
  });
});

describe("AUDIO_SOURCE_IDS", () => {
  it("offers exactly two sources", () => {
    expect(AUDIO_SOURCE_IDS).toHaveLength(2);
  });

  it("contains no per-application member", () => {
    expect(AUDIO_SOURCE_IDS).not.toContain(REMOVED_SOURCE);
  });

  it("contains system and microphone", () => {
    expect([...AUDIO_SOURCE_IDS].sort()).toEqual(["microphone", "system"]);
  });
});

describe("toRuntimeAudioSource", () => {
  it("delegates to the shared normalizer rather than keeping a private copy", () => {
    for (const value of [
      "microphone",
      "system",
      REMOVED_SOURCE,
      "nonsense",
      undefined,
      null,
      42
    ]) {
      expect(toRuntimeAudioSource(value)).toBe(normalizeAudioSource(value));
    }
  });
});

describe("the audio-source union is declared without a per-application member", () => {
  /** Grab a single declaration statement, so surrounding prose cannot mask a regression. */
  function declarationRegion(source: string, pattern: RegExp): string {
    const match = source.match(pattern);
    expect(match, `declaration not found: ${pattern}`).not.toBeNull();
    return match![0];
  }

  it("in src/components/UnifiedPanel/types.ts", () => {
    const region = declarationRegion(
      read("src/components/UnifiedPanel/types.ts"),
      /export type AudioSourceType =[^\r\n]*/
    );
    expect(region).not.toContain(REMOVED_SOURCE);
  });

  it("in src/types/index.ts", () => {
    const region = declarationRegion(
      read("src/types/index.ts"),
      /export type AudioSource =[^\r\n]*/
    );
    expect(region).not.toContain(REMOVED_SOURCE);
  });

  it("in the AudioConfig interface in electron/ConfigHelper.ts", () => {
    const audioConfigBlock = declarationRegion(
      read("electron/ConfigHelper.ts"),
      /interface AudioConfig \{[\s\S]*?\n\}/
    );
    const sourceLine = declarationRegion(audioConfigBlock, /^\s*source:[^\r\n]*/m);
    expect(sourceLine).not.toContain(REMOVED_SOURCE);
  });

  it("and AudioConfig no longer carries an application name in either declaration", () => {
    expect(read("electron/ConfigHelper.ts")).not.toContain("applicationName");
    expect(read("src/types/index.ts")).not.toContain("applicationName");
  });
});

describe("the per-application capture affordance is gone from the shipped path", () => {
  it("removes the window-enumeration IPC from the preload bridge", () => {
    // Leaving the channel in place would leave the affordance one line from re-wiring.
    expect(read("electron/preload.ts")).not.toContain('ipcRenderer.invoke("get-audio-sources")');
    expect(read("electron/preload.ts")).not.toContain("getAudioSources");
  });

  it("removes the window-enumeration handler from the main process", () => {
    const handlers = read("electron/ipcHandlers.ts");
    expect(handlers).not.toContain('registerHandle("get-audio-sources"');
    expect(handlers).not.toContain('"get-audio-sources"');
  });

  it("keeps the unrelated screenshot source picker, which is a different feature", () => {
    expect(read("electron/ipcHandlers.ts")).toContain('"get-capture-sources"');
  });

  it("removes the desktop-capture branch from the live capture hook", () => {
    const capture = stripLineComments(read("src/components/UnifiedPanel/useAudioCapture.ts"));
    expect(capture).not.toContain("chromeMediaSource");
  });
});

describe("the quarantined legacy capture services stay quarantined", () => {
  /**
   * Both still declare a three-member union and a working per-application capture.
   * Deleting a quarantined module is a separate decision with its own blast radius, so
   * this task asserts the quarantine instead of acting on it. Named in the summary as
   * the first candidate for a dead-code pass.
   */
  const LEGACY_MODULES = [
    "src/services/AudioCaptureService.legacy.ts",
    "electron/audio/AudioCaptureService.legacy.ts"
  ];

  it("excludes *.legacy.ts from both typecheck projects", () => {
    expect(JSON.parse(read("tsconfig.json")).exclude).toContain("**/*.legacy.ts");
    expect(JSON.parse(read("tsconfig.electron.json")).exclude).toContain("**/*.legacy.ts");
  });

  it.each(LEGACY_MODULES)("leaves %s imported by nothing", (modulePath) => {
    const moduleName = modulePath.split("/").pop()!.replace(/\.ts$/, "");
    const importers = collectSourceFiles(join(REPO_ROOT, "electron"), [])
      .concat(collectSourceFiles(join(REPO_ROOT, "src"), []))
      .filter((file) => !file.endsWith(".legacy.ts"))
      .filter((file) => {
        const body = stripLineComments(readFileSync(file, "utf8"));
        return body.includes(moduleName);
      });
    expect(importers).toEqual([]);
  });
});

function collectSourceFiles(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "dist-electron") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}
