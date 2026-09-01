/**
 * Standing gate for en/ru locale symmetry.
 *
 * The two locale files have historically stayed in sync by discipline alone.
 * This test makes the symmetry enforced rather than hoped for: any key added
 * to one file and not the other fails here, and the failure message names the
 * drifted keys instead of merely counting them.
 */
/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import en from '../../src/i18n/locales/en.json'
import ru from '../../src/i18n/locales/ru.json'

/**
 * Minimum key count. 262 keys existed before the quick-260831-wf4 confirmation
 * work; that task added 16. The threshold is deliberately the post-task number
 * so deleting the new keys from BOTH files cannot quietly pass this gate.
 */
const MIN_KEYS = 279

/** Keys introduced by quick-260831-wf4. Asserted explicitly in both locales. */
const WF4_KEYS = [
    'confirm.cancel',
    'confirm.keyEscape',
    'confirm.keyEnter',
    'confirm.quit.title',
    'confirm.quit.description',
    'confirm.quit.confirmLabel',
    'confirm.clearHistory.title',
    'confirm.clearHistory.description',
    'confirm.clearHistory.confirmLabel',
    'confirm.deleteSession.title',
    'confirm.deleteSession.description',
    'confirm.deleteSession.confirmLabel',
    'settings.actions.guidedSetup',
    'settings.apiKeyRequired.heading',
    'settings.apiKeyRequired.body',
    'settings.apiKeyRequired.getKey'
]

function flatten(value: unknown, prefix = ''): string[] {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return [prefix]
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key)
    )
}

const enKeys = flatten(en).sort()
const ruKeys = flatten(ru).sort()

describe('i18n locale parity', () => {
    it('en and ru have identical key sets', () => {
        const enSet = new Set(enKeys)
        const ruSet = new Set(ruKeys)
        const missingInRu = enKeys.filter((k) => !ruSet.has(k))
        const missingInEn = ruKeys.filter((k) => !enSet.has(k))

        const message = [
            missingInRu.length ? `missing in ru.json: ${missingInRu.join(', ')}` : '',
            missingInEn.length ? `missing in en.json: ${missingInEn.join(', ')}` : ''
        ].filter(Boolean).join(' | ')

        expect(message, message || 'locales in sync').toBe('')
        expect(enKeys).toEqual(ruKeys)
    })

    it('en and ru have the same key count, at or above the standing floor', () => {
        expect(enKeys.length).toBe(ruKeys.length)
        expect(enKeys.length).toBeGreaterThanOrEqual(MIN_KEYS)
    })

    it.each(WF4_KEYS)('en.json defines %s', (key) => {
        expect(enKeys).toContain(key)
    })

    it.each(WF4_KEYS)('ru.json defines %s', (key) => {
        expect(ruKeys).toContain(key)
    })

    it('no locale value is an empty string', () => {
        const read = (root: unknown, path: string): unknown =>
            path.split('.').reduce<unknown>(
                (acc, part) => (acc && typeof acc === 'object'
                    ? (acc as Record<string, unknown>)[part]
                    : undefined),
                root
            )
        const empties = [...enKeys.map((k) => ['en', k, read(en, k)] as const),
        ...ruKeys.map((k) => ['ru', k, read(ru, k)] as const)]
            .filter(([, , value]) => typeof value === 'string' && value.trim() === '')
            .map(([locale, key]) => `${locale}:${key}`)
        expect(empties).toEqual([])
    })
})
