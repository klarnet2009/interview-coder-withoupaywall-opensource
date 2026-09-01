import React, { Component, ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    handleClearCacheAndReload = (): void => {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (e) {
            console.warn('Failed to clear cache:', e);
        }
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-black flex items-center justify-center p-6 select-none">
                    <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                                <svg
                                    className="w-5 h-5 text-red-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-white">
                                    Something went wrong
                                </h2>
                                <p className="text-xs text-zinc-400">
                                    An unexpected application error was caught
                                </p>
                            </div>
                        </div>

                        <p className="text-zinc-300 text-xs mb-4 leading-relaxed">
                            Try clicking Try Again, or Clear Cache & Reload if the issue persists after updating settings.
                        </p>

                        {this.state.error && (
                            <div className="bg-black/60 border border-white/5 rounded-xl p-3 mb-4 overflow-auto max-h-32">
                                <code className="text-xs text-red-400 font-mono break-all">
                                    {this.state.error.message}
                                </code>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={this.handleRetry}
                                className="flex-1"
                            >
                                Try Again
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={this.handleClearCacheAndReload}
                                className="flex-1 border border-amber-500/20 text-amber-300"
                            >
                                Clear Cache & Reload
                            </Button>
                            <Button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="flex-1"
                            >
                                Reload App
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
