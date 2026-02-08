import { SavedSnippet } from "../types";

export interface RestoredDebugWorkspacePayload {
  code: string;
  debug_analysis: string;
  thoughts: string[];
  issues: string[];
  fixes: string[];
  why: string[];
  verify: string[];
  next_steps: string[];
  time_complexity: string;
  space_complexity: string;
}

export interface RestoredSolutionWorkspacePayload {
  code: string;
  thoughts: string[];
  time_complexity: string;
  space_complexity: string;
}

export type RestoredWorkspacePayload =
  | { target: "debug"; payload: RestoredDebugWorkspacePayload }
  | { target: "solution"; payload: RestoredSolutionWorkspacePayload };

export function restoreSnippetWorkspace(
  snippet: SavedSnippet
): RestoredWorkspacePayload {
  if (snippet.workspace?.type === "debug") {
    const payload: RestoredDebugWorkspacePayload = {
      code: snippet.workspace.code || snippet.answer,
      debug_analysis: snippet.answer,
      thoughts: snippet.workspace.keyPoints || [snippet.question],
      issues: snippet.workspace.issues || [],
      fixes: snippet.workspace.fixes || [],
      why: snippet.workspace.why || [],
      verify: snippet.workspace.verify || [],
      next_steps: snippet.workspace.verify || [],
      time_complexity: snippet.workspace.timeComplexity || "N/A - Debug mode",
      space_complexity: snippet.workspace.spaceComplexity || "N/A - Debug mode"
    };

    return { target: "debug", payload };
  }

  const payload: RestoredSolutionWorkspacePayload = {
    code: snippet.workspace?.code || snippet.answer,
    thoughts: snippet.workspace?.keyPoints || [snippet.question],
    time_complexity:
      snippet.workspace?.timeComplexity || "Loaded from session history",
    space_complexity:
      snippet.workspace?.spaceComplexity || "Loaded from session history"
  };

  return { target: "solution", payload };
}
