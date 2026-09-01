/**
 * Standing gates for the project's declared design system.
 *
 * Three related properties are enforced here, and the file is deliberately
 * built around one shared harness that compiles class names through the
 * project's OWN `src/index.css` rather than through Tailwind's defaults.
 * That distinction is the whole point: `bg-primary` is a perfectly valid
 * class in a project that declares `--color-primary`, and a no-op in this
 * one. A gate compiled against defaults would pass and prove nothing.
 *
 * The quick-260901-jav planning directory carries the measurements every
 * threshold in this file comes from.
 */
/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { compile } from 'tailwindcss'

const ROOT = process.cwd()
const STYLESHEET = path.join(ROOT, 'src', 'index.css')
const TAILWIND_ENTRY = path.join(ROOT, 'node_modules', 'tailwindcss', 'index.css')

// ---------------------------------------------------------------------------
// Shared harness
// ---------------------------------------------------------------------------

function readStylesheet(): string {
    return fs.readFileSync(STYLESHEET, 'utf8')
}

/**
 * Compile `classes` against the project's real stylesheet and return the CSS.
 *
 * `src/index.css` has exactly one `@import`, so `loadStylesheet` can ignore its
 * arguments and always hand back Tailwind's own entry point.
 */
async function buildCss(classes: string[]): Promise<string> {
    const compiler = await compile(readStylesheet(), {
        base: ROOT,
        loadStylesheet: async () => ({
            path: TAILWIND_ENTRY,
            base: path.dirname(TAILWIND_ENTRY),
            content: fs.readFileSync(TAILWIND_ENTRY, 'utf8')
        })
    })
    return compiler.build(classes)
}

/**
 * The selector Tailwind emits for a class name.
 *
 * Everything outside `[A-Za-z0-9_-]` is escaped rather than an enumerated set:
 * Tailwind also escapes `#`, `(`, `)`, `,`, `%` and `&`, so an enumerated list
 * would produce false failures on any future arbitrary-value or
 * opacity-modifier class and teach the next reader to distrust these gates.
 */
function selectorFor(cls: string): string {
    return '.' + cls.replace(/[^A-Za-z0-9_-]/g, (ch) => String.fromCharCode(92) + ch)
}

/** The body of the `@theme` block in `src/index.css`, brace-matched. */
function themeBlock(css: string): string {
    const open = css.indexOf('@theme')
    if (open === -1) throw new Error('src/index.css has no @theme block')
    const start = css.indexOf('{', open)
    let depth = 0
    for (let i = start; i < css.length; i += 1) {
        if (css[i] === '{') depth += 1
        else if (css[i] === '}') {
            depth -= 1
            if (depth === 0) return css.slice(start + 1, i)
        }
    }
    throw new Error('src/index.css has an unterminated @theme block')
}

/** Every `--name: value` declaration inside `@theme`, in source order. */
function themeDeclarations(css: string): Array<{ name: string; value: string }> {
    const body = themeBlock(css)
    const found: Array<{ name: string; value: string }> = []
    const pattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(body)) !== null) {
        found.push({ name: match[1], value: match[2].trim() })
    }
    return found
}

/** Source files the hex and opacity gates walk. */
function sourceFiles(extensions: string[] = ['.ts', '.tsx']): string[] {
    const out: string[] = []
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) walk(full)
            else if (extensions.includes(path.extname(entry.name))) out.push(full)
        }
    }
    walk(path.join(ROOT, 'src'))
    return out
}

/**
 * Remove comments so a colour written in prose is not mistaken for a literal.
 * `//` is only treated as a line comment when it is not part of a URL scheme.
 */
function stripComments(text: string): string {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:/])\/\/[^\n\r]*/g, '$1')
}

// ---------------------------------------------------------------------------
// Token equivalence
// ---------------------------------------------------------------------------

/**
 * Every colour token and the raw literal it replaced.
 *
 * The mapping is the proof that the 22 hex-literal substitutions changed no
 * value. One source literal was upper-case (`#161B22` in `_pages/DebugLive`),
 * so the comparison is case-insensitive.
 */
const COLOUR_TOKENS: Array<{ token: string; literal: string; utility: string }> = [
    { token: '--color-surface-base', literal: '#0a0a0a', utility: 'bg-surface-base' },
    { token: '--color-surface-raised', literal: '#1a1a1a', utility: 'bg-surface-raised' },
    { token: '--color-surface-code', literal: '#0d1117', utility: 'bg-surface-code' },
    {
        token: '--color-surface-code-raised',
        literal: '#161B22',
        utility: 'bg-surface-code-raised'
    }
]

describe('token equivalence', () => {
    it('declares each colour token exactly once inside @theme', () => {
        const declarations = themeDeclarations(readStylesheet())
        for (const { token } of COLOUR_TOKENS) {
            const hits = declarations.filter((d) => d.name === token)
            expect(
                hits.length,
                `${token} is declared ${hits.length} times inside @theme; expected exactly once`
            ).toBe(1)
        }
    })

    it('gives each colour token the exact value of the literal it replaced', () => {
        const declarations = themeDeclarations(readStylesheet())
        for (const { token, literal } of COLOUR_TOKENS) {
            const declared = declarations.find((d) => d.name === token)?.value ?? ''
            expect(
                declared.toLowerCase(),
                `${token} is declared as "${declared}" but replaced the literal "${literal}". ` +
                    'Tokenising the 22 component hex literals was supposed to be lossless; ' +
                    'a mismatch here means a surface colour silently changed.'
            ).toBe(literal.toLowerCase())
        }
    })

    it('compiles each colour token utility to a real rule', async () => {
        const utilities = COLOUR_TOKENS.map((t) => t.utility)
        const css = await buildCss(utilities)
        const inert = utilities.filter((u) => !css.includes(selectorFor(u)))
        expect(
            inert,
            `these token utilities emit no CSS at all against this project's own src/index.css: ${inert.join(', ')}`
        ).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// Zero hex literals
// ---------------------------------------------------------------------------

describe('colour values live in exactly one file', () => {
    it('has no hex colour literal anywhere in src/**/*.{ts,tsx}', () => {
        const offenders: string[] = []
        for (const file of sourceFiles()) {
            const text = stripComments(fs.readFileSync(file, 'utf8'))
            const matches = text.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g)
            if (matches) {
                offenders.push(`${path.relative(ROOT, file)}: ${[...new Set(matches)].join(', ')}`)
            }
        }
        expect(
            offenders,
            'A hex colour literal is back in a component. There were 36 before quick-260901-jav: ' +
                '14 went with the deleted token module under src/styles and 22 moved into the @theme ' +
                'block of src/index.css, which is now the only file in the project where a colour ' +
                'value is written. Add the colour there as a token and use the generated utility.\n' +
                offenders.join('\n')
        ).toEqual([])
    })
})
