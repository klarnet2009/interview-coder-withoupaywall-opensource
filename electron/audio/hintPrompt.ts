/**
 * hintPrompt - the prompt text that decides how a hint answers.
 *
 * Depth and voice are decided in exactly ONE place: the style block.
 * Nothing outside `STYLE_BLOCKS` may add a withholding rule ("don't give away
 * the solution") or a length rule ("be brief") - a global rule of either kind
 * silently fights whichever style the user picked, and the styles that are
 * meant to hand over a full answer (`full`, `echo`) lose to it.
 */

export type AnswerStyleKey =
    | 'hints'
    | 'full'
    | 'bullets'
    | 'echo'
    // Legacy values kept for backward compatibility with stored preferences.
    | 'concise'
    | 'detailed'
    | 'star'
    | 'structured';

export const DEFAULT_ANSWER_STYLE: AnswerStyleKey = 'structured';

export const STYLE_BLOCKS: Record<AnswerStyleKey, string> = {
    hints: 'Give ONLY hints and directions. Do NOT give the actual answer. Help the candidate think through the problem themselves. Use 1-3 short hints like "Think about using a hash map" or "Consider edge cases with empty input".',

    full: 'Provide a complete, structured answer the candidate can read and paraphrase. Include the reasoning, approach, and a clear solution. Use paragraphs and bullet points for readability.',

    bullets: 'Give key points as bullet points only. No fluff, no long explanations. 3-5 crisp bullet points that cover the essential answer.',

    echo: `Write the answer in first person, as the candidate saying it out loud in the room. They read it word for word, so it has to work as speech rather than as written prose read aloud: no bullet points, no headings, no code blocks, no stage directions or bracketed asides. Three to six sentences.

Let it sound like someone thinking in real time. Use one or two of these per answer, never more: open in rough, abstract terms before you get precise ("the shape of this is really just a sliding window - so concretely, I'd keep two pointers and move the left one whenever the window goes invalid"); hedge on the one part that genuinely is uncertain ("I'd want to check the exact number, but it's linear in the number of keys"); say plainly that you don't know, where the candidate honestly wouldn't, and in the same breath say how you'd find out; correct yourself once mid-sentence ("I'd cache it at the edge - well, at the edge for reads, the writes still have to go through"); or let one closing thought trail off on a dash instead of tying it into a neat conclusion.

The substance still has to be right, and it still has to land. Hedge the detail you are actually unsure of, never the main claim, and never manufacture doubt about something you do know. Keep the sentence that carries the answer whole - the unfinished thought is an aside, never the point. One hesitation reads as human; three in a row reads as someone who did not prepare. No stacked fillers ("um, like, you know"), and write any hesitation in the language you are speaking, not in English.`,

    concise: 'Be extremely brief. Give 1-2 bullet points maximum. No explanations, just key points.',

    detailed: 'Provide detailed, comprehensive answers with explanations, examples, and reasoning.',

    star: 'Structure answers using the STAR method: Situation, Task, Action, Result.',

    structured: 'Give structured answers with 3-4 bullet points. Balance brevity with clarity.'
};

export type InterviewModeKey = 'behavioral' | 'general' | 'system_design' | 'coding' | 'programming';

export const DEFAULT_INTERVIEW_MODE: InterviewModeKey = 'coding';

export const MODE_BLOCKS: Record<InterviewModeKey, string> = {
    behavioral: 'This is a behavioral/general interview. Focus on soft skills, STAR method examples, and interpersonal scenarios.',
    general: 'This is a behavioral/general interview. Focus on soft skills, STAR method examples, and interpersonal scenarios.',
    system_design: 'This is a system design interview. Focus on architecture, scalability, trade-offs, and design patterns.',
    coding: 'This is a coding/programming interview. Focus on algorithms, data structures, code solutions, and time/space complexity.',
    programming: 'This is a coding/programming interview. Focus on algorithms, data structures, code solutions, and time/space complexity.'
};

function isAnswerStyleKey(style: string): style is AnswerStyleKey {
    return Object.prototype.hasOwnProperty.call(STYLE_BLOCKS, style);
}

function isInterviewModeKey(mode: string): mode is InterviewModeKey {
    return Object.prototype.hasOwnProperty.call(MODE_BLOCKS, mode);
}

/** Unknown or custom styles fall back to the default, as the old switch did. */
export function styleBlockFor(style?: string | null): string {
    if (style && isAnswerStyleKey(style)) return STYLE_BLOCKS[style];
    return STYLE_BLOCKS[DEFAULT_ANSWER_STYLE];
}

/** Unknown modes fall back to coding, as the old switch did. */
export function modeBlockFor(mode?: string | null): string {
    if (mode && isInterviewModeKey(mode)) return MODE_BLOCKS[mode];
    return MODE_BLOCKS[DEFAULT_INTERVIEW_MODE];
}
