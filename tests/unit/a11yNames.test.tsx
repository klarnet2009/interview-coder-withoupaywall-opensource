// @vitest-environment jsdom
/**
 * Accessible-name gate for the icon-only controls.
 *
 * These assertions deliberately check the *computed* accessible name rather
 * than the presence of an attribute, and they check it in Russian as well as
 * English. A hardcoded English `title` can satisfy an attribute-presence rule;
 * it cannot satisfy this one, because the app ships a second language and the
 * accessible name is spoken text.
 */
/// <reference types="vitest/globals" />

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { ToastContext } from '../../src/contexts/toast'
import { UnifiedPanel } from '../../src/components/UnifiedPanel/UnifiedPanel'
import i18n from '../../src/i18n'
import en from '../../src/i18n/locales/en.json'
import ru from '../../src/i18n/locales/ru.json'

const SRC_ROOT = join(__dirname, '..', '..', 'src')

/**
 * The UnifiedPanel is the component that owns the settings gear, so covering
 * the gear through the same code path the browser uses means rendering it.
 * Its only external surface is `window.electronAPI`: every `on*` member is a
 * subscription returning an unsubscribe function, every other member is an
 * async call. A proxy satisfies both shapes without enumerating the API.
 */
function installElectronApiMock(): void {
    const unsubscribe = () => undefined
    const api = new Proxy(
        {},
        {
            get: (_target, prop) => {
                if (typeof prop !== 'string') return undefined
                if (prop.startsWith('on')) return () => unsubscribe
                return async () => ({})
            },
            has: () => true
        }
    )
    Object.defineProperty(window, 'electronAPI', {
        value: api,
        writable: true,
        configurable: true
    })
}

function renderUnifiedPanel() {
    installElectronApiMock()
    return render(
        <ToastContext.Provider value={{ showToast: vi.fn() }}>
            <UnifiedPanel
                screenshots={[]}
                onDeleteScreenshot={vi.fn()}
                screenshotCount={0}
                credits={0}
                currentLanguage="en"
                setLanguage={vi.fn()}
                onTooltipVisibilityChange={vi.fn()}
            />
        </ToastContext.Provider>
    )
}

async function setLocale(language: 'en' | 'ru'): Promise<void> {
    await act(async () => {
        await i18n.changeLanguage(language)
    })
}

beforeEach(async () => {
    await setLocale('en')
})

afterEach(async () => {
    cleanup()
    await act(async () => {
        await i18n.changeLanguage('en')
    })
})

describe('UnifiedPanel settings menu', () => {
    it('names the settings gear from the en locale', async () => {
        await act(async () => {
            renderUnifiedPanel()
        })
        expect(screen.getByRole('button', { name: 'Open settings' })).toBeTruthy()
    })

    it('names the settings gear from the ru locale', async () => {
        await act(async () => {
            renderUnifiedPanel()
        })
        await setLocale('ru')
        expect(screen.getByRole('button', { name: 'Открыть настройки' })).toBeTruthy()
    })

    it('declares a popup and reports its collapsed state', async () => {
        await act(async () => {
            renderUnifiedPanel()
        })
        const gear = screen.getByRole('button', { name: 'Open settings' })
        expect(gear.getAttribute('aria-haspopup')).toBe('menu')
        expect(gear.getAttribute('aria-expanded')).toBe('false')
    })

    it('reports the expanded state once the menu is open', async () => {
        await act(async () => {
            renderUnifiedPanel()
        })
        const gear = screen.getByRole('button', { name: 'Open settings' })
        await act(async () => {
            fireEvent.click(gear)
        })
        expect(gear.getAttribute('aria-expanded')).toBe('true')
        expect(screen.getByRole('menu')).toBeTruthy()
    })

    it('closes the settings menu on Escape', async () => {
        await act(async () => {
            renderUnifiedPanel()
        })
        const gear = screen.getByRole('button', { name: 'Open settings' })
        await act(async () => {
            fireEvent.click(gear)
        })
        expect(screen.queryByRole('menu')).not.toBeNull()

        await act(async () => {
            fireEvent.keyDown(document, { key: 'Escape' })
        })
        expect(screen.queryByRole('menu')).toBeNull()
        expect(gear.getAttribute('aria-expanded')).toBe('false')
    })
})

function collectTsxFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
            collectTsxFiles(full, out)
        } else if (entry.endsWith('.tsx')) {
            out.push(full)
        }
    }
    return out
}

/**
 * Static keys only. A template literal such as t(`a11y.state.${state}`) is
 * intentionally skipped here — its members are asserted by name in
 * i18nParity.test.ts, which is the right place for a key set that source
 * scanning cannot enumerate.
 */
function referencedA11yKeys(): string[] {
    const keys = new Set<string>()
    for (const file of collectTsxFiles(SRC_ROOT)) {
        const source = readFileSync(file, 'utf8')
        for (const match of source.matchAll(/\bt\(\s*['"](a11y\.[^'"]+)['"]/g)) {
            keys.add(match[1])
        }
    }
    return [...keys].sort()
}

function read(root: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (acc, part) =>
            acc && typeof acc === 'object'
                ? (acc as Record<string, unknown>)[part]
                : undefined,
        root
    )
}

describe('a11y key resolution', () => {
    it('finds a11y keys referenced in src', () => {
        expect(referencedA11yKeys().length).toBeGreaterThan(0)
    })

    it('resolves every referenced a11y key to a non-empty string in both locales', () => {
        const broken: string[] = []
        for (const key of referencedA11yKeys()) {
            for (const [name, bundle] of [['en', en], ['ru', ru]] as const) {
                const value = read(bundle, key)
                if (typeof value !== 'string' || value.trim() === '') {
                    broken.push(`${name}:${key}`)
                }
            }
        }
        expect(broken).toEqual([])
    })
})
