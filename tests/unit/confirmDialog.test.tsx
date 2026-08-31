// @vitest-environment jsdom
/**
 * Keyboard contract for the ConfirmDialog primitive.
 *
 * The dialog gates destructive actions during a live interview, so the whole
 * point is that it can be resolved without reaching for the mouse: Escape
 * cancels, Enter confirms, and focus starts on Cancel so a stray Space or
 * click lands on the safe option.
 */
/// <reference types="vitest/globals" />

import { describe, it, expect, vi, afterEach } from 'vitest'
import type React from 'react'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from '../../src/components/ui/confirm-dialog'
import '../../src/i18n'

afterEach(() => {
    cleanup()
})

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
        <ConfirmDialog
            open
            onOpenChange={onOpenChange}
            title="Quit Interview Coder?"
            description="The app closes immediately."
            confirmLabel="Quit"
            onConfirm={onConfirm}
            {...overrides}
        />
    )
    return { onConfirm, onOpenChange }
}

describe('ConfirmDialog', () => {
    it('renders the title and description when open', () => {
        renderDialog()
        expect(screen.getByText('Quit Interview Coder?')).toBeTruthy()
        expect(screen.getByText('The app closes immediately.')).toBeTruthy()
    })

    it('renders the Esc and Enter key hints', () => {
        renderDialog()
        expect(screen.getByText('Esc')).toBeTruthy()
        expect(screen.getByText('Enter')).toBeTruthy()
    })

    it('cancels on Escape without confirming', async () => {
        const { onConfirm, onOpenChange } = renderDialog()
        fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
        await waitFor(() => {
            expect(onOpenChange).toHaveBeenCalledWith(false)
        })
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('confirms exactly once on Enter', async () => {
        const { onConfirm } = renderDialog()
        const dialog = await screen.findByRole('dialog')
        fireEvent.keyDown(dialog, { key: 'Enter' })
        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledTimes(1)
        })
    })

    it('places initial focus on Cancel, not on the confirm button', async () => {
        renderDialog()
        const cancel = await screen.findByRole('button', { name: /Cancel/i })
        await waitFor(() => {
            expect(document.activeElement).toBe(cancel)
        })
    })

    it('cancels when Cancel is clicked, without confirming', async () => {
        const { onConfirm, onOpenChange } = renderDialog()
        const cancel = await screen.findByRole('button', { name: /Cancel/i })
        fireEvent.click(cancel)
        await waitFor(() => {
            expect(onOpenChange).toHaveBeenCalledWith(false)
        })
        expect(onConfirm).not.toHaveBeenCalled()
    })
})
