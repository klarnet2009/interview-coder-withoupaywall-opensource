/**
 * AppState - Global state management using React Context
 * Replaces unsafe window.__ globals with type-safe React state
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AppState {
    credits: number;
    language: string;
    isInitialized: boolean;
}

interface AppStateContextType {
    state: AppState;
    setCredits: (credits: number) => void;
    setLanguage: (language: string) => void;
    setInitialized: (initialized: boolean) => void;
}

const defaultState: AppState = {
    credits: 999,
    language: 'python',
    isInitialized: false,
};

const AppStateContext = createContext<AppStateContextType | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AppState>(defaultState);

    const setCredits = useCallback((credits: number) => {
        setState(prev => ({ ...prev, credits }));
    }, []);

    const setLanguage = useCallback((language: string) => {
        setState(prev => ({ ...prev, language }));
    }, []);

    const setInitialized = useCallback((isInitialized: boolean) => {
        setState(prev => ({ ...prev, isInitialized }));
    }, []);

    return (
        <AppStateContext.Provider value={{ state, setCredits, setLanguage, setInitialized }}>
            {children}
        </AppStateContext.Provider>
    );
}

export function useAppState(): AppStateContextType {
    const context = useContext(AppStateContext);
    if (!context) {
        throw new Error('useAppState must be used within an AppStateProvider');
    }
    return context;
}

// Convenience hooks for specific state values
export function useCredits(): [number, (credits: number) => void] {
    const { state, setCredits } = useAppState();
    return [state.credits, setCredits];
}

export function useLanguage(): [string, (language: string) => void] {
    const { state, setLanguage } = useAppState();
    return [state.language, setLanguage];
}

export function useIsInitialized(): [boolean, (initialized: boolean) => void] {
    const { state, setInitialized } = useAppState();
    return [state.isInitialized, setInitialized];
}
