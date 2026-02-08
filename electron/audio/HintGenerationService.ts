/**
 * HintGenerationService - Generates interview hints using Gemini 3 Flash
 * 
 * Features:
 * - Multi-turn conversation history: model sees all previous Q&A pairs
 * - Explicit caching: system instruction cached server-side for cost/latency savings
 * - SSE streaming via Node.js https for reliable Electron streaming
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import https from 'https';
import { IncomingMessage } from 'http';

const HINT_MODEL = 'gemini-3-flash-preview';
const API_BASE_HOST = 'generativelanguage.googleapis.com';

interface ConversationTurn {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

export interface HintResponse {
    text: string;
    isComplete: boolean;
    timestamp: number;
}

export class HintGenerationService extends EventEmitter {
    private apiKey: string;
    private model: string;
    private systemInstruction: string;
    private currentRequest: any = null;
    private isGenerating: boolean = false;
    private spokenLanguage: string;
    private interviewMode: string;
    private answerStyle: string;

    // Conversation context
    private conversationHistory: ConversationTurn[] = [];
    private cachedContentName: string | null = null;
    private cacheAttempted: boolean = false;

    constructor(apiKey: string, model?: string, spokenLanguage?: string, interviewMode?: string, answerStyle?: string) {
        super();
        this.apiKey = apiKey;
        this.model = model || HINT_MODEL;
        this.spokenLanguage = spokenLanguage || 'en';
        this.interviewMode = interviewMode || 'coding';
        this.answerStyle = answerStyle || 'structured';
        this.systemInstruction = this.getDefaultSystemInstruction();
    }

    private getDefaultSystemInstruction(): string {
        // Build mode-specific instructions
        let modeInstruction = '';
        switch (this.interviewMode) {
            case 'behavioral':
            case 'general':
                modeInstruction = 'This is a behavioral/general interview. Focus on soft skills, STAR method examples, and interpersonal scenarios.';
                break;
            case 'system_design':
                modeInstruction = 'This is a system design interview. Focus on architecture, scalability, trade-offs, and design patterns.';
                break;
            case 'coding':
            case 'programming':
            default:
                modeInstruction = 'This is a coding/programming interview. Focus on algorithms, data structures, code solutions, and time/space complexity.';
                break;
        }

        // Build style-specific instructions
        let styleInstruction = '';
        switch (this.answerStyle) {
            case 'hints':
                styleInstruction = 'Give ONLY hints and directions. Do NOT give the actual answer. Help the candidate think through the problem themselves. Use 1-3 short hints like "Think about using a hash map" or "Consider edge cases with empty input".';
                break;
            case 'full':
                styleInstruction = 'Provide a complete, structured answer the candidate can read and paraphrase. Include the reasoning, approach, and a clear solution. Use paragraphs and bullet points for readability.';
                break;
            case 'bullets':
                styleInstruction = 'Give key points as bullet points only. No fluff, no long explanations. 3-5 crisp bullet points that cover the essential answer.';
                break;
            case 'echo':
                styleInstruction = 'Write the answer in FIRST PERSON as if YOU are the candidate speaking naturally in a real interview. Use conversational tone — the candidate should be able to read your response WORD FOR WORD out loud. Include natural speech patterns like "So, the way I would approach this is...", "In my experience...", "What I think is important here is...". Do NOT use bullet points or headers — write flowing speech. Keep it concise (3-6 sentences) so it sounds natural, not rehearsed.';
                break;
            // Legacy values for backward compatibility
            case 'concise':
                styleInstruction = 'Be extremely brief. Give 1-2 bullet points maximum. No explanations, just key points.';
                break;
            case 'detailed':
                styleInstruction = 'Provide detailed, comprehensive answers with explanations, examples, and reasoning.';
                break;
            case 'star':
                styleInstruction = 'Structure answers using the STAR method: Situation, Task, Action, Result.';
                break;
            case 'structured':
            default:
                styleInstruction = 'Give structured answers with 3-4 bullet points. Balance brevity with clarity.';
                break;
        }

        return `You are an AI interview assistant helping a candidate during a technical interview.

${modeInstruction}

Your role:
- Analyze the interviewer's questions (provided as transcript)
- Provide concise, helpful hints and answers
- ALWAYS respond in the SAME LANGUAGE as the interviewer's question. If the question is in Russian, respond in Russian. If in English, respond in English. Match the language exactly.
- ${styleInstruction}
- Be brief - the candidate needs to respond quickly
- If the question is about code, provide pseudocode or key concepts only
- You have full context of the interview so far — use it to give better, non-repetitive answers
- Reference previous questions if relevant to build a coherent picture

Be helpful but don't give away complete solutions - guide the candidate.`;
    }

    public setSystemInstruction(instruction: string): void {
        this.systemInstruction = instruction;
    }

    public setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    public setModel(model: string): void {
        this.model = model;
    }

    /**
     * Create an explicit cache for the system instruction + conversation history.
     * Called automatically after first hint when there's enough content (>1024 tokens).
     * Not called at session start since system instruction alone is too small.
     */
    public async createCache(): Promise<void> {
        if (!this.apiKey || this.cacheAttempted || this.cachedContentName) return;
        this.cacheAttempted = true;

        // Estimate token count: ~4 chars per token
        const historyText = this.conversationHistory.map(t => t.parts[0].text).join(' ');
        const totalChars = this.systemInstruction.length + historyText.length;
        const estimatedTokens = Math.ceil(totalChars / 4);

        if (estimatedTokens < 1100) {
            log.info(`HintGenerationService: Not enough content for cache yet (~${estimatedTokens} tokens, need 1024+)`);
            this.cacheAttempted = false; // Allow retry after more content accumulates
            return;
        }

        const path = `/v1beta/cachedContents?key=${this.apiKey}`;
        const body = JSON.stringify({
            model: `models/${this.model}`,
            displayName: `interview-session-${Date.now()}`,
            systemInstruction: {
                parts: [{ text: this.systemInstruction }]
            },
            contents: this.conversationHistory,
            ttl: '3600s'
        });

        try {
            const result = await this.httpsPost(path, body);
            const data = JSON.parse(result);
            if (data.name) {
                this.cachedContentName = data.name;
                log.info(`HintGenerationService: Cache created (~${estimatedTokens} tokens): ${this.cachedContentName}`);
            } else {
                log.warn('HintGenerationService: Cache creation returned no name');
            }
        } catch (err: any) {
            log.info(`HintGenerationService: Cache creation deferred (${err.message})`);
            this.cacheAttempted = false; // Retry next time
        }
    }

    /**
     * Delete the explicit cache.
     * Called on session stop to clean up server-side resources.
     */
    public async deleteCache(): Promise<void> {
        if (!this.cachedContentName || !this.apiKey) return;

        const path = `/v1beta/${this.cachedContentName}?key=${this.apiKey}`;

        try {
            await this.httpsRequest('DELETE', path);
            log.info(`HintGenerationService: Cache deleted: ${this.cachedContentName}`);
        } catch (err: any) {
            log.warn(`HintGenerationService: Cache deletion failed: ${err.message}`);
        } finally {
            this.cachedContentName = null;
        }
    }

    /**
     * Clear conversation history (e.g., on topic change)
     */
    public clearHistory(): void {
        this.conversationHistory = [];
        log.info('HintGenerationService: Conversation history cleared');
    }

    /**
     * Generate hints from accumulated transcript.
     * Sends full conversation history for context.
     * Uses cached system instruction if available.
     */
    public async generateHint(transcript: string): Promise<void> {
        if (!transcript.trim()) {
            log.warn('HintGenerationService: Empty transcript, skipping');
            return;
        }

        if (!this.apiKey) {
            log.error('HintGenerationService: No API key configured');
            this.emit('error', new Error('No API key configured'));
            return;
        }

        // Cancel any in-progress generation
        this.abort();

        this.isGenerating = true;

        const path = `/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

        // Build contents: conversation history + new user message
        const userMessage: ConversationTurn = {
            role: 'user',
            parts: [{ text: `Interviewer said:\n\n"${transcript}"\n\nProvide concise hints to help the candidate answer.` }]
        };

        const contents = [...this.conversationHistory, userMessage];

        // Build request body — use cache if available, otherwise inline system instruction
        const requestPayload: any = {
            contents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
            }
        };

        if (this.cachedContentName) {
            requestPayload.cachedContent = this.cachedContentName;
        } else {
            requestPayload.systemInstruction = {
                parts: [{ text: this.systemInstruction }]
            };
        }

        const requestBody = JSON.stringify(requestPayload);

        try {
            log.info(`HintGenerationService: Generating hint (${transcript.length} chars, ${this.conversationHistory.length} history turns, cache: ${!!this.cachedContentName})`);

            const accumulatedText = await this.streamRequest(path, requestBody);

            // Append to conversation history for future context
            if (accumulatedText) {
                this.conversationHistory.push(userMessage);
                this.conversationHistory.push({
                    role: 'model',
                    parts: [{ text: accumulatedText }]
                });
                log.info(`HintGenerationService: History now has ${this.conversationHistory.length} turns`);

                // Try to create cache once we have enough content
                if (!this.cachedContentName) {
                    this.createCache().catch(() => { });
                }
            }

        } catch (error: any) {
            if (error.message?.includes('aborted') || error.code === 'ECONNRESET') {
                log.info('HintGenerationService: Generation aborted');
                return;
            }
            log.error('HintGenerationService: Generation failed', error);
            this.emit('error', error);
        } finally {
            this.isGenerating = false;
            this.currentRequest = null;
        }
    }

    /**
     * Stream SSE response from Gemini API
     */
    private streamRequest(path: string, requestBody: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let accumulatedText = '';
            let buffer = '';

            const options = {
                hostname: API_BASE_HOST,
                port: 443,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                },
            };

            const req = https.request(options, (res: IncomingMessage) => {
                if (res.statusCode !== 200) {
                    let errorBody = '';
                    res.on('data', (chunk: Buffer) => { errorBody += chunk.toString(); });
                    res.on('end', () => {
                        reject(new Error(`API error ${res.statusCode}: ${errorBody}`));
                    });
                    return;
                }

                res.setEncoding('utf8');

                res.on('data', (chunk: string) => {
                    buffer += chunk;

                    // Process complete SSE lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data: ')) continue;

                        const jsonStr = trimmed.slice(6).trim();
                        if (!jsonStr || jsonStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(jsonStr);
                            const candidate = data.candidates?.[0];
                            const text = candidate?.content?.parts?.[0]?.text;
                            const finishReason = candidate?.finishReason;

                            if (finishReason) {
                                log.info(`HintGenerationService: finishReason=${finishReason}`);
                            }

                            if (text) {
                                accumulatedText += text;
                                this.emit('hint', {
                                    text: accumulatedText,
                                    isComplete: false,
                                    timestamp: Date.now()
                                } as HintResponse);
                            }
                        } catch (parseErr) {
                            log.warn(`HintGenerationService: Parse error: ${trimmed.slice(0, 200)}`);
                        }
                    }
                });

                res.on('end', () => {
                    // Process remaining buffer
                    if (buffer.trim() && buffer.trim().startsWith('data: ')) {
                        const jsonStr = buffer.trim().slice(6).trim();
                        if (jsonStr && jsonStr !== '[DONE]') {
                            try {
                                const data = JSON.parse(jsonStr);
                                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) accumulatedText += text;
                            } catch (_) { }
                        }
                    }

                    // Emit final complete hint
                    if (accumulatedText) {
                        log.info(`HintGenerationService: FINAL hint (${accumulatedText.length} chars)`);
                        this.emit('hint', {
                            text: accumulatedText,
                            isComplete: true,
                            timestamp: Date.now()
                        } as HintResponse);
                    }
                    resolve(accumulatedText);
                });

                res.on('error', (err: Error) => reject(err));
            });

            req.on('error', (err: Error) => reject(err));

            this.currentRequest = req;
            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Simple HTTPS POST helper (for cache creation)
     */
    private httpsPost(path: string, body: string): Promise<string> {
        return this.httpsRequest('POST', path, body);
    }

    /**
     * Generic HTTPS request helper
     */
    private httpsRequest(method: string, path: string, body?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const options: https.RequestOptions = {
                hostname: API_BASE_HOST,
                port: 443,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
                },
            };

            const req = https.request(options, (res: IncomingMessage) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
                res.on('error', reject);
            });

            req.on('error', reject);
            if (body) req.write(body);
            req.end();
        });
    }

    /**
     * Abort current generation
     */
    public abort(): void {
        if (this.currentRequest) {
            this.currentRequest.destroy();
            this.currentRequest = null;
        }
        this.isGenerating = false;
    }

    /**
     * Check if currently generating
     */
    public isActive(): boolean {
        return this.isGenerating;
    }
}
