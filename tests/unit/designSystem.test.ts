/**
 * Standing gates for the project's declared design system.
 *
 * Several related properties are enforced here, and the file is deliberately
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
const BUTTON = path.join(ROOT, 'src', 'components', 'ui', 'button.tsx')

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

/** The `{ ... }` body that starts at `from`, brace-matched. */
function blockAt(text: string, from: number): { body: string; end: number } {
    const start = text.indexOf('{', from)
    if (start === -1) throw new Error('no block found')
    let depth = 0
    for (let i = start; i < text.length; i += 1) {
        if (text[i] === '{') depth += 1
        else if (text[i] === '}') {
            depth -= 1
            if (depth === 0) return { body: text.slice(start + 1, i), end: i }
        }
    }
    throw new Error('unterminated block')
}

/** The declaration body of the rule Tailwind emitted for `cls`. */
function ruleFor(css: string, cls: string): string {
    // The trailing ` {` disambiguates `.bg-white\/glass` from
    // `.bg-white\/glass-hover`, which shares its prefix.
    const idx = css.indexOf(selectorFor(cls) + ' {')
    if (idx === -1) throw new Error(`no rule was emitted for "${cls}"`)
    return blockAt(css, idx).body
}

function norm(css: string): string {
    return css.replace(/\s+/g, ' ').trim()
}

/**
 * Split a rule into the declarations that always apply and those guarded by the
 * `@supports (color: color-mix(in lab, ...))` branch Tailwind emits for oklab.
 */
function splitRule(body: string): { unconditional: string; supports: string } {
    const at = body.indexOf('@supports')
    if (at === -1) return { unconditional: norm(body), supports: '' }
    return { unconditional: norm(body.slice(0, at)), supports: norm(blockAt(body, at).body) }
}

/** The body of the `@theme` block in `src/index.css`, brace-matched. */
function themeBlock(css: string): string {
    const open = css.indexOf('@theme')
    if (open === -1) throw new Error('src/index.css has no @theme block')
    return blockAt(css, open).body
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

function themeValue(token: string): string {
    const hit = themeDeclarations(readStylesheet()).find((d) => d.name === token)
    if (!hit) throw new Error(`${token} is not declared in @theme`)
    return hit.value
}

/** Source files the token, hex and opacity gates walk. */
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

/**
 * Every class token in the `cva` call in `button.tsx`.
 *
 * The `defaultVariants` block is cut off first: `"default"` and `"sm"` there
 * are variant *keys*, not classes, and would otherwise be reported as inert.
 */
function buttonVariantClasses(): string[] {
    const src = fs.readFileSync(BUTTON, 'utf8')
    const start = src.indexOf('cva(')
    if (start === -1) throw new Error('button.tsx no longer calls cva()')
    let depth = 0
    let end = -1
    for (let i = src.indexOf('(', start); i < src.length; i += 1) {
        if (src[i] === '(') depth += 1
        else if (src[i] === ')') {
            depth -= 1
            if (depth === 0) {
                end = i
                break
            }
        }
    }
    let region = src.slice(start, end)
    const defaults = region.indexOf('defaultVariants')
    if (defaults !== -1) region = region.slice(0, defaults)
    const literals = region.match(/"[^"]*"/g) ?? []
    return [
        ...new Set(
            literals.flatMap((literal) => literal.slice(1, -1).split(/\s+/)).filter(Boolean)
        )
    ]
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

/** Every named opacity step and the number it aliases. */
const OPACITY_TOKENS: Array<{ token: string; name: string; numeric: number }> = [
    { token: '--opacity-glass-subtle', name: 'glass-subtle', numeric: 5 },
    { token: '--opacity-glass', name: 'glass', numeric: 10 },
    { token: '--opacity-glass-hover', name: 'glass-hover', numeric: 20 },
    { token: '--opacity-ink-secondary', name: 'ink-secondary', numeric: 70 },
    { token: '--opacity-solid-hover', name: 'solid-hover', numeric: 90 }
]

const ALL_TOKENS = [...COLOUR_TOKENS.map((t) => t.token), ...OPACITY_TOKENS.map((t) => t.token)]

describe('token equivalence', () => {
    it('declares every token exactly once inside @theme', () => {
        const declarations = themeDeclarations(readStylesheet())
        for (const token of ALL_TOKENS) {
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

    /**
     * The gate that makes the no-mass-rename strategy defensible rather than
     * merely asserted. `bg-white/glass` and `bg-white/10` are computed-
     * equivalent, NOT byte-identical across the whole rule: the unconditional
     * declaration matches exactly, while inside the `@supports` oklab branch
     * the named form carries `var(--opacity-glass)` where the numeric carries
     * `10%`. A naive whole-rule comparison fails on all five pairs. That var
     * indirection is not a weakness in the proof — it is the aliasing the
     * token exists to buy, which is why it is resolved rather than ignored.
     */
    it('proves each named opacity step is the number it aliases', async () => {
        const classes = OPACITY_TOKENS.flatMap((t) => [
            `bg-white/${t.name}`,
            `bg-white/${t.numeric}`
        ])
        const css = await buildCss(classes)

        for (const { token, name, numeric } of OPACITY_TOKENS) {
            const named = splitRule(ruleFor(css, `bg-white/${name}`))
            const plain = splitRule(ruleFor(css, `bg-white/${numeric}`))

            expect(
                named.unconditional,
                `bg-white/${name} and bg-white/${numeric} must emit a byte-identical ` +
                    'unconditional background-color; they no longer do, so the named form ' +
                    'is not a pure alias and every site still on the number has drifted.'
            ).toBe(plain.unconditional)

            expect(
                named.supports.includes(`var(${token})`),
                `bg-white/${name} should reach its value through var(${token}) in the ` +
                    `@supports branch, but emitted: ${named.supports}`
            ).toBe(true)

            const resolved = named.supports.split(`var(${token})`).join(themeValue(token))
            expect(
                resolved,
                `once var(${token}) is resolved against its @theme value, bg-white/${name} ` +
                    `must match bg-white/${numeric} inside the @supports oklab branch.`
            ).toBe(plain.supports)
        }
    })
})

// ---------------------------------------------------------------------------
// Zero hex literals
// ---------------------------------------------------------------------------

describe('colour values live in exactly one file', () => {
    it('has no hex colour literal anywhere in the .ts and .tsx sources', () => {
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

// ---------------------------------------------------------------------------
// No inert classes in the button primitive
// ---------------------------------------------------------------------------

describe('the button primitive emits real CSS', () => {
    /**
     * This is the gate that would have caught the defect this task fixes.
     * It names what is inert rather than reporting a count, because a class
     * that compiles to nothing is invisible until someone looks at the screen.
     */
    it('compiles every class in buttonVariants to a rule against src/index.css', async () => {
        const classes = buttonVariantClasses()
        expect(classes.length).toBeGreaterThan(20)

        const css = await buildCss(classes)
        const inert = classes.filter((cls) => !css.includes(selectorFor(cls)))

        expect(
            inert,
            'These buttonVariants classes emit NO CSS AT ALL against this project\'s own ' +
                'src/index.css, so the variants carrying them paint nothing:\n  ' +
                inert.join('\n  ') +
                '\nThe usual cause is a colour utility whose theme key this project never ' +
                'declares (stock shadcn names such as bg-primary or border-input), or a ' +
                'misspelled opacity token, which fails silently in exactly the same way.'
        ).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// No dead tokens
// ---------------------------------------------------------------------------

describe('every declared token is load-bearing', () => {
    /**
     * The property `src/styles/design-system.ts` lacked: 403 lines, 13 exports
     * and not one importer anywhere in the shipped code. It would have failed
     * this gate on all thirteen. A second unconsumed token layer is the one
     * outcome quick-260901-jav must not produce.
     */
    it('finds at least one consumer for each surface and opacity token', () => {
        const css = readStylesheet()
        const sources = sourceFiles().map((file) => ({
            file,
            text: fs.readFileSync(file, 'utf8')
        }))

        const orphans: string[] = []
        for (const token of ALL_TOKENS) {
            const stem = token.replace(/^--(?:color|opacity)-/, '')
            // A stem must match a whole class segment: `glass` must not be
            // satisfied by `glass-hover`, or a token could look consumed by
            // a different token's utility.
            const asModifier = new RegExp(`/${stem}(?![A-Za-z0-9-])`)
            const asColour = new RegExp(`-${stem}(?![A-Za-z0-9-])`)
            const consumed =
                css.includes(`var(${token})`) ||
                sources.some(({ text }) => asModifier.test(text) || asColour.test(text))
            if (!consumed) orphans.push(token)
        }

        expect(
            orphans,
            'These tokens are declared in @theme but nothing reads them: ' +
                orphans.join(', ') +
                '. A token is declared only when a consumer is wired to it in the same ' +
                'change; otherwise it becomes the next dead token layer.'
        ).toEqual([])
    })
})
