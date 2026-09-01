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
 * work; that task added 16, reaching 278. quick-260831-xan then added 33
 * accessible-name labels. The threshold is deliberately the post-task number
 * so deleting the new keys from BOTH files cannot quietly pass this gate.
 */
const MIN_KEYS = 311

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

/**
 * Accessible-name keys introduced by quick-260831-xan. Every one of these is
 * spoken text, so a missing Russian value is a user-facing regression rather
 * than a cosmetic one.
 */
const XAN_LABEL_KEYS = [
    'a11y.label.openSettings',
    'a11y.label.openDebug',
    'a11y.label.openDevTools',
    'a11y.label.chooseCaptureSource',
    'a11y.label.refreshCaptureSources',
    'a11y.label.refreshAudioSources',
    'a11y.label.refreshWindows',
    'a11y.label.minimizeWindow',
    'a11y.label.closeWindow',
    'a11y.label.closeSettings',
    'a11y.label.hideWindow',
    'a11y.label.closeHotkeys',
    'a11y.label.startListening',
    'a11y.label.stopListening',
    'a11y.label.removeScreenshot',
    'a11y.label.copyResponse',
    'a11y.label.toggleResponseLength',
    'a11y.label.deleteScreenshot',
    'a11y.label.screenshotPreview',
    'a11y.label.closePreview',
    'a11y.label.backToSessions',
    'a11y.label.closeSessionHistory',
    'a11y.label.deleteSession',
    'a11y.label.closeWizard',
    'a11y.label.closeProfileManager',
    'a11y.label.setActiveProfile',
    'a11y.label.editProfile',
    'a11y.label.deleteProfile',
    'a11y.label.closeDebugView',
    'a11y.label.pasteApiKey',
    'a11y.label.showApiKey',
    'a11y.label.hideApiKey',
    'a11y.label.opaqueMode'
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

    it.each(XAN_LABEL_KEYS)('en.json defines %s', (key) => {
        expect(enKeys).toContain(key)
    })

    it.each(XAN_LABEL_KEYS)('ru.json defines %s', (key) => {
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
