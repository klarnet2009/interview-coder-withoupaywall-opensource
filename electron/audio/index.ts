/**
 * Audio module exports
 */

// Legacy capture abstraction quarantined:
// `AudioCaptureService.legacy.ts` is intentionally excluded from active runtime builds.

export { GeminiLiveService } from './GeminiLiveService';
export type { GeminiLiveConfig, TranscriptUpdate, AIResponse } from './GeminiLiveService';

export { LiveInterviewService } from './LiveInterviewService';
export type { ListeningState, ListeningStatus, LiveInterviewConfig } from './LiveInterviewService';
