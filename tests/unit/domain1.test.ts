/**
 * Unit tests for Domain 1: Core Engine, Hotkeys & Config Persistence
 */
/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ConfigHelper } from '../../electron/ConfigHelper'

describe('Domain 1: ConfigHelper API key validation', () => {
    let configHelper: ConfigHelper

    beforeEach(() => {
        configHelper = new ConfigHelper()
    })

    it('validates OpenAI keys with sk-proj- and hyphens/underscores', () => {
        const standardKey = 'sk-1234567890abcdef1234567890abcdef'
        const projKey = 'sk-proj-abc123_-XYZ78901234567890abcdef'
        expect(configHelper.isValidApiKeyFormat(standardKey, 'openai')).toBe(true)
        expect(configHelper.isValidApiKeyFormat(projKey, 'openai')).toBe(true)
        expect(configHelper.isValidApiKeyFormat(projKey)).toBe(true)
        expect(configHelper.validateApiKey(projKey)).toBe(true)
    })

    it('validates Anthropic keys with sk-ant- and hyphens/underscores', () => {
        const antKey = 'sk-ant-api03-abcdef123456_-789012345678'
        expect(configHelper.isValidApiKeyFormat(antKey, 'anthropic')).toBe(true)
        expect(configHelper.isValidApiKeyFormat(antKey)).toBe(true)
        expect(configHelper.validateApiKey(antKey)).toBe(true)
    })

    it('validates Gemini keys (length >= 10)', () => {
        const geminiKey = 'AIzaSyD-1234567890abcdef'
        expect(configHelper.isValidApiKeyFormat(geminiKey, 'gemini')).toBe(true)
        expect(configHelper.isValidApiKeyFormat(geminiKey)).toBe(true)
    })

    it('rejects short or invalid format keys', () => {
        expect(configHelper.isValidApiKeyFormat('short', 'gemini')).toBe(false)
        expect(configHelper.isValidApiKeyFormat('sk-short', 'openai')).toBe(false)
        expect(configHelper.isValidApiKeyFormat('sk-ant-short', 'anthropic')).toBe(false)
    })
})

describe('Domain 1: ConfigHelper updateConfig non-destructive persistence', () => {
    let tmpDir: string
    let helper: ConfigHelper

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ic-test-config-'))
        helper = new ConfigHelper()
        // Override configPath for isolated test
        ;(helper as unknown as { configPath: string }).configPath = path.join(tmpDir, 'config.json')
    })

    afterEach(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch { /* ignore */ }
    })

    it('persists profile and interview preferences without deleting fields', () => {
        const updated = helper.updateConfig({
            interviewMode: 'behavioral',
            responseStyle: 'star',
            responseLength: 'concise',
            programmingLanguage: 'typescript',
            interviewLevel: 'senior',
            interviewFocus: ['system_design', 'algorithms'],
            customTopic: 'Distributed Systems',
            interfaceLanguage: 'ru',
            profileName: 'Senior Engineer',
            profileExperience: '7',
            profileSkills: 'React, TypeScript, Node.js, Go'
        })

        // Check interviewPreferences
        expect(updated.interviewPreferences).toBeDefined()
        expect(updated.interviewPreferences.mode).toBe('behavioral')
        expect(updated.interviewPreferences.answerStyle).toBe('star')
        expect(updated.interviewPreferences.programmingLanguage).toBe('typescript')
        expect(updated.interviewPreferences.interviewLevel).toBe('senior')
        expect(updated.interviewPreferences.interviewFocus).toEqual(['system_design', 'algorithms'])
        expect(updated.interviewPreferences.customTopic).toBe('Distributed Systems')
        expect(updated.interviewPreferences.interfaceLanguage).toBe('ru')
        expect(updated.interviewPreferences.responseLength).toBe('concise')

        // Check profiles collection
        expect(updated.profiles.length).toBeGreaterThan(0)
        const profile = updated.profiles[0]
        expect(profile.name).toBe('Senior Engineer')
        expect(profile.yearsExperience).toBe(7)
        expect(profile.skills).toEqual(['React', 'TypeScript', 'Node.js', 'Go'])

        // Check flat fields are also preserved for direct UI binding
        expect(updated.profileName).toBe('Senior Engineer')
        expect(updated.programmingLanguage).toBe('typescript')
        expect(updated.interviewLevel).toBe('senior')
        expect(updated.interfaceLanguage).toBe('ru')

        // Verify disk persistence
        const loaded = helper.loadConfig()
        expect(loaded.interviewPreferences.mode).toBe('behavioral')
        expect(loaded.profiles[0].name).toBe('Senior Engineer')
        expect(loaded.profileName).toBe('Senior Engineer')
    })
})
