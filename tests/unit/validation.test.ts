/**
 * Unit tests for IPC validation utilities
 */
/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import {
    validateString,
    validateNumber,
    validateEnum,
    validateConfigUpdate,
    validateFilePath
} from '../../electron/validation'

describe('validateString', () => {
    it('returns success for valid string', () => {
        const result = validateString('hello', 'field')
        expect(result.success).toBe(true)
        expect(result.data).toBe('hello')
    })

    it('returns error for non-string', () => {
        const result = validateString(123, 'field')
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be a string')
    })

    it('validates minLength', () => {
        const result = validateString('hi', 'field', { minLength: 5 })
        expect(result.success).toBe(false)
        expect(result.error).toContain('at least 5')
    })

    it('validates maxLength', () => {
        const result = validateString('hello world', 'field', { maxLength: 5 })
        expect(result.success).toBe(false)
        expect(result.error).toContain('at most 5')
    })

    it('validates pattern', () => {
        const result = validateString('abc', 'field', { pattern: /^\d+$/ })
        expect(result.success).toBe(false)
        expect(result.error).toContain('invalid format')
    })

    it('passes pattern validation', () => {
        const result = validateString('123', 'field', { pattern: /^\d+$/ })
        expect(result.success).toBe(true)
        expect(result.data).toBe('123')
    })
})

describe('validateNumber', () => {
    it('returns success for valid number', () => {
        const result = validateNumber(42, 'field')
        expect(result.success).toBe(true)
        expect(result.data).toBe(42)
    })

    it('returns error for non-number', () => {
        const result = validateNumber('42', 'field')
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be a number')
    })

    it('returns error for NaN', () => {
        const result = validateNumber(NaN, 'field')
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be a number')
    })

    it('validates min bound', () => {
        const result = validateNumber(5, 'field', { min: 10 })
        expect(result.success).toBe(false)
        expect(result.error).toContain('at least 10')
    })

    it('validates max bound', () => {
        const result = validateNumber(15, 'field', { max: 10 })
        expect(result.success).toBe(false)
        expect(result.error).toContain('at most 10')
    })

    it('validates integer requirement', () => {
        const result = validateNumber(3.14, 'field', { integer: true })
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be an integer')
    })

    it('accepts valid integer', () => {
        const result = validateNumber(42, 'field', { integer: true })
        expect(result.success).toBe(true)
        expect(result.data).toBe(42)
    })
})

describe('validateEnum', () => {
    const providers = ['openai', 'gemini', 'anthropic'] as const

    it('returns success for valid enum value', () => {
        const result = validateEnum('gemini', 'provider', providers)
        expect(result.success).toBe(true)
        expect(result.data).toBe('gemini')
    })

    it('returns error for invalid enum value', () => {
        const result = validateEnum('invalid', 'provider', providers)
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be one of')
    })

    it('returns error for non-string', () => {
        const result = validateEnum(123, 'provider', providers)
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be a string')
    })
})

describe('validateConfigUpdate', () => {
    it('returns success for valid config', () => {
        const result = validateConfigUpdate({
            apiKey: 'test-key',
            apiProvider: 'gemini',
            language: 'python',
            opacity: 0.8
        })
        expect(result.success).toBe(true)
        expect(result.data?.apiKey).toBe('test-key')
        expect(result.data?.apiProvider).toBe('gemini')
    })

    it('returns error for non-object', () => {
        const result = validateConfigUpdate('invalid')
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be an object')
    })

    it('returns error for invalid provider', () => {
        const result = validateConfigUpdate({ apiProvider: 'invalid' })
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be one of')
    })

    it('returns error for invalid opacity', () => {
        const result = validateConfigUpdate({ opacity: 1.5 })
        expect(result.success).toBe(false)
        expect(result.error).toContain('at most 1')
    })

    it('accepts empty object', () => {
        const result = validateConfigUpdate({})
        expect(result.success).toBe(true)
        expect(result.data).toEqual({})
    })

    it('validates wizardCompleted boolean', () => {
        const result = validateConfigUpdate({ wizardCompleted: 'yes' })
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be a boolean')
    })
})

describe('validateFilePath', () => {
    it('returns success for valid path', () => {
        const result = validateFilePath('/path/to/file.txt', 'path')
        expect(result.success).toBe(true)
        expect(result.data).toBe('/path/to/file.txt')
    })

    it('rejects path traversal', () => {
        const result = validateFilePath('../etc/passwd', 'path')
        expect(result.success).toBe(false)
        expect(result.error).toContain('invalid characters')
    })

    it('rejects null bytes', () => {
        const result = validateFilePath('path\0evil', 'path')
        expect(result.success).toBe(false)
        expect(result.error).toContain('invalid characters')
    })

    it('returns error for non-string', () => {
        const result = validateFilePath(123, 'path')
        expect(result.success).toBe(false)
        expect(result.error).toContain('must be a string')
    })
})
