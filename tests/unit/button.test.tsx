// @vitest-environment jsdom
/**
 * Contract for the Button primitive.
 *
 * The primitive was rebuilt in quick-260901-jav because stock shadcn's variant
 * classes compiled to nothing in this project — `<Button>` with default props
 * painted a bare box-shadow around no fill, no border and no text colour. The
 * first test below is that defect stated as a property: render the component
 * and prove the classes it actually emits produce a real background against
 * the project's own stylesheet. jsdom does not apply Tailwind, so the proof
 * runs the rendered class list back through the compiler rather than reading
 * `getComputedStyle`, which would be vacuous here.
 *
 * The exhaustive keyboard contract for ConfirmDialog lives in
 * `confirmDialog.test.tsx`; the case here is the narrower question of whether
 * routing its footer through this primitive broke it.
 */
/// <reference types="vitest/globals" />

import { describe, it, expect, vi, afterEach } from 'vitest'
import * as React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { compile } from 'tailwindcss'
import { Button } from '../../src/components/ui/button'
import { ConfirmDialog } from '../../src/components/ui/confirm-dialog'
import '../../src/i18n'

afterEach(() => {
    cleanup()
})

const ROOT = process.cwd()

async function buildCss(classes: string[]): Promise<string> {
    const compiler = await compile(fs.readFileSync(path.join(ROOT, 'src', 'index.css'), 'utf8'), {
        base: ROOT,
        loadStylesheet: async () => {
            const entry = path.join(ROOT, 'node_modules', 'tailwindcss', 'index.css')
            return { path: entry, base: path.dirname(entry), content: fs.readFileSync(entry, 'utf8') }
        }
    })
    return compiler.build(classes)
}

const VARIANTS = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const
const SIZES = ['default', 'sm', 'lg', 'icon'] as const

describe('Button', () => {
    it('renders a default button whose classes produce a real background', async () => {
        render(<Button>Go</Button>)
        const classes = screen.getByRole('button', { name: 'Go' }).className.split(/\s+/).filter(Boolean)
        expect(classes.length).toBeGreaterThan(0)

        const css = await buildCss(classes)
        const declarations = [...css.matchAll(/background-color:\s*([^;]+);/g)].map((m) => m[1].trim())

        expect(
            declarations.filter((value) => value.length > 0),
            'The default variant emitted no background-color at all. This is the exact ' +
                'defect quick-260901-jav fixed: a colour utility whose theme key this project ' +
                'never declares generates no rule, so the button paints nothing.'
        ).not.toHaveLength(0)
    })

    it('renders every variant and every size', () => {
        for (const variant of VARIANTS) {
            for (const size of SIZES) {
                cleanup()
                render(
                    <Button variant={variant} size={size}>
                        {`${variant}-${size}`}
                    </Button>
                )
                const el = screen.getByRole('button', { name: `${variant}-${size}` })
                expect(el.tagName).toBe('BUTTON')
                expect(el.className.trim().length).toBeGreaterThan(0)
            }
        }
    })

    it('forwards ref to the underlying element', () => {
        const ref = React.createRef<HTMLButtonElement>()
        render(<Button ref={ref}>Focus me</Button>)
        expect(ref.current).toBeInstanceOf(HTMLButtonElement)
        ref.current?.focus()
        expect(document.activeElement).toBe(ref.current)
    })

    it('renders the child element rather than a nested button when asChild is set', () => {
        render(
            <Button asChild>
                <a href="https://example.test">Linked</a>
            </Button>
        )
        const link = screen.getByRole('link', { name: 'Linked' })
        expect(link.tagName).toBe('A')
        expect(link.querySelector('button')).toBeNull()
        expect(screen.queryByRole('button')).toBeNull()
        // The variant classes still reach the child.
        expect(link.className.trim().length).toBeGreaterThan(0)
    })

    it('lets a caller className win over the variant for the same property', () => {
        render(<Button className="bg-black">Override</Button>)
        const classes = screen
            .getByRole('button', { name: 'Override' })
            .className.split(/\s+/)
            .filter(Boolean)

        expect(classes).toContain('bg-black')
        expect(
            classes,
            'twMerge should have dropped the variant background in favour of the caller\'s. ' +
                'WelcomeScreen and UpdateNotification looked right only because their className ' +
                'beat a variant that emitted nothing; now that the variant emits real CSS, this ' +
                'conflict resolution is what keeps caller overrides working.'
        ).not.toContain('bg-white')
    })

    it('keeps the migrated ConfirmDialog footer working through the primitive', async () => {
        const onConfirm = vi.fn()
        const onOpenChange = vi.fn()
        render(
            <ConfirmDialog
                open
                onOpenChange={onOpenChange}
                title="Quit?"
                description="The app closes immediately."
                confirmLabel="Quit"
                onConfirm={onConfirm}
            />
        )

        const cancel = await screen.findByRole('button', { name: /Cancel/i })
        await waitFor(() => {
            expect(document.activeElement).toBe(cancel)
        })

        fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Enter' })
        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledTimes(1)
        })
    })
})
