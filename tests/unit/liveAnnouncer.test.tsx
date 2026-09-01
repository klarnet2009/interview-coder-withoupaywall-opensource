// @vitest-environment jsdom
/**
 * Contract for the announcer primitive.
 *
 * The app's primary output — the interviewer's words and the session state —
 * reaches a screen-reader user through this one component. Two mechanisms are
 * load-bearing and are asserted separately here because either one alone still
 * produces the failure mode they exist to prevent: a settle window, so a
 * partial-transcription stream is not narrated token by token, and a prefix
 * delta, so only the newly appended tail is spoken rather than the whole
 * accumulated transcript re-read from the top.
 */
/// <reference types="vitest/globals" />

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, act, renderHook } from '@testing-library/react'
import {
    LiveAnnouncer,
    announcementDelta,
    useSettledValue
} from '../../src/components/a11y'

afterEach(() => {
    cleanup()
})

describe('announcementDelta', () => {
    it('returns only the appended tail when the transcript grew', () => {
        expect(announcementDelta('Tell me about', 'Tell me about yourself')).toBe(
            ' yourself'
        )
    })

    it('returns the whole string when the transcript is not a continuation', () => {
        expect(announcementDelta('Tell me about', 'Describe a project')).toBe(
            'Describe a project'
        )
    })

    it('announces nothing when the transcript is cleared', () => {
        expect(announcementDelta('anything', '')).toBe('')
    })

    /**
     * Mirrors getUnprocessedTranscriptDelta in the main process, which returns
     * the whole current transcript when nothing has been consumed yet. Two
     * divergent notions of "what is new" over one transcript stream would be a
     * bug waiting to happen.
     */
    it('returns the whole string when nothing has been announced yet', () => {
        expect(announcementDelta('', 'Tell me about yourself')).toBe(
            'Tell me about yourself'
        )
    })
})

describe('useSettledValue', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('emits once with the final value after a burst of rapid updates', () => {
        const { result, rerender } = renderHook(
            ({ value }: { value: string }) => useSettledValue(value, 1000),
            { initialProps: { value: 'a' } }
        )

        const observed: string[] = [result.current]

        for (const value of ['b', 'c', 'd', 'e', 'f']) {
            act(() => {
                rerender({ value })
                vi.advanceTimersByTime(100)
            })
            observed.push(result.current)
        }

        // Nothing has settled yet: the stream never went quiet for long enough.
        expect(observed.every((seen) => seen === 'a')).toBe(true)

        act(() => {
            vi.advanceTimersByTime(1000)
        })

        const emissions = [...observed, result.current].filter(
            (seen, index, all) => index === 0 || seen !== all[index - 1]
        )
        expect(emissions).toEqual(['a', 'f'])
    })

    it('clears its pending timer on unmount', () => {
        const { rerender, unmount } = renderHook(
            ({ value }: { value: string }) => useSettledValue(value, 1000),
            { initialProps: { value: 'a' } }
        )
        act(() => {
            rerender({ value: 'b' })
        })
        unmount()
        expect(() => {
            act(() => {
                vi.advanceTimersByTime(5000)
            })
        }).not.toThrow()
    })
})

describe('LiveAnnouncer', () => {
    it('renders a polite, atomic status region that is visually hidden', () => {
        render(<LiveAnnouncer message="Status: Listening" />)
        const region = screen.getByRole('status')
        expect(region.getAttribute('aria-live')).toBe('polite')
        expect(region.getAttribute('aria-atomic')).toBe('true')
        expect(region.className).toContain('sr-only')
        expect(region.textContent).toBe('Status: Listening')
    })

    /**
     * The region has to exist before the first announcement. A screen reader
     * that only sees the node appear at the same moment as its text will
     * usually miss the announcement entirely.
     */
    it('renders an empty but present region when there is nothing to say', () => {
        render(<LiveAnnouncer message="" />)
        const region = screen.getByRole('status')
        expect(region).toBeTruthy()
        expect(region.textContent).toBe('')
    })

    it('is never assertive', () => {
        render(<LiveAnnouncer message="Session error" />)
        expect(screen.getByRole('status').getAttribute('aria-live')).not.toBe(
            'assertive'
        )
    })
})
