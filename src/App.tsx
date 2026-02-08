import SubscribedApp from "./_pages/SubscribedApp"
import DebugLive from "./_pages/DebugLive"
import { Routes, Route } from "react-router-dom"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { UpdateNotification } from "./components/UpdateNotification"
import { DevModeToggle } from "./components/DevModeToggle"
import { WizardContainer } from "./components/Wizard/WizardContainer"
import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query"
import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from "./components/ui/toast"
import { ToastContext } from "./contexts/toast"
import { WelcomeScreen } from "./components/WelcomeScreen"
import { SettingsPage } from "./components/Settings/SettingsPage"
import { AppConfig, WizardMode } from "./types"

interface ProcessingStatusState {
  visible: boolean
  message: string
  progress: number
}

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
})

// Root component that provides the QueryClient
function App() {
  const { t } = useTranslation();
  const [toastState, setToastState] = useState({
    open: false,
    title: "",
    description: "",
    variant: "neutral" as "neutral" | "success" | "error"
  })
  const [credits, setCredits] = useState<number>(999) // Unlimited credits
  const [currentLanguage, setCurrentLanguage] = useState<string>("python")
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusState>({
    visible: false,
    message: "",
    progress: 0
  })

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardCompleted, setWizardCompleted] = useState(false)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Set unlimited credits
  const updateCredits = useCallback(() => {
    setCredits(999) // No credit limit in this version
  }, [])

  // Helper function to safely update language
  const updateLanguage = useCallback((newLanguage: string) => {
    setCurrentLanguage(newLanguage)
  }, [])

  // Helper function to mark initialization complete
  const markInitialized = useCallback(() => {
    setIsInitialized(true)
  }, [])

  // Show toast method
  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        variant
      })
    },
    []
  )

  // Check for wizard completion and API key
  useEffect(() => {
    const checkAppState = async () => {
      try {
        const [hasKey, isWizardDone] = await Promise.all([
          window.electronAPI.checkApiKey(),
          window.electronAPI.isWizardCompleted()
        ])

        setHasApiKey(hasKey)
        setWizardCompleted(isWizardDone)

        console.log("App state check:", { hasKey, isWizardDone })

        // Show wizard if not completed (even if has API key - for new users)
        if (!isWizardDone) {
          console.log("Wizard not completed, showing wizard")
          setShowWizard(true)
        } else if (!hasKey) {
          // Wizard done but no API key - show settings
          console.log("No API key, opening settings automatically")
          setTimeout(() => {
            setIsSettingsOpen(true)
          }, 1000)
        } else {
          console.log("App ready - hasKey:", hasKey, "wizardDone:", isWizardDone)
        }
      } catch (error) {
        console.error("Failed to check app state:", error)
      }
    }

    if (isInitialized) {
      checkAppState()
    }
  }, [isInitialized])

  // Initialize dropdown handler
  useEffect(() => {
    if (isInitialized) {
      // Process all types of dropdown elements with a shorter delay
      const timer = setTimeout(() => {
        // Find both native select elements and custom dropdowns
        const selectElements = document.querySelectorAll('select');
        const customDropdowns = document.querySelectorAll('.dropdown-trigger, [role="combobox"], button:has(.dropdown)');

        // Enable native selects
        selectElements.forEach(dropdown => {
          dropdown.disabled = false;
        });

        // Enable custom dropdowns by removing any disabled attributes
        customDropdowns.forEach(dropdown => {
          if (dropdown instanceof HTMLElement) {
            dropdown.removeAttribute('disabled');
            dropdown.setAttribute('aria-disabled', 'false');
          }
        });

        console.log(`Enabled ${selectElements.length} select elements and ${customDropdowns.length} custom dropdowns`);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  // Listen for settings dialog open requests
  useEffect(() => {
    const unsubscribeSettings = window.electronAPI.onShowSettings(() => {
      console.log("Show settings dialog requested");
      setIsSettingsOpen(true);
    });

    return () => {
      unsubscribeSettings();
    };
  }, []);

  // Global processing status visibility
  useEffect(() => {
    const hideProcessingStatus = () => {
      setProcessingStatus({
        visible: false,
        message: "",
        progress: 0
      })
    }

    const unsubscribeStatus = window.electronAPI.onProcessingStatus((status) => {
      const progress = Math.max(0, Math.min(100, Number(status.progress) || 0))
      setProcessingStatus({
        visible: true,
        message: status.message || "Processing...",
        progress
      })
    })

    const cleanupFunctions = [
      window.electronAPI.onSolutionSuccess(hideProcessingStatus),
      window.electronAPI.onSolutionError(hideProcessingStatus),
      window.electronAPI.onDebugSuccess(hideProcessingStatus),
      window.electronAPI.onDebugError(hideProcessingStatus),
      window.electronAPI.onResetView(hideProcessingStatus),
      window.electronAPI.onProcessingNoScreenshots(hideProcessingStatus)
    ]

    return () => {
      unsubscribeStatus()
      cleanupFunctions.forEach((fn) => fn())
    }
  }, [])

  // Initialize basic app state
  useEffect(() => {
    // Load config and set values
    const initializeApp = async () => {
      try {
        // Set unlimited credits
        updateCredits()

        // Load config including language and model settings
        const config = await window.electronAPI.getConfig()

        // Load language preference
        if (config && config.language) {
          updateLanguage(config.language)
        } else {
          updateLanguage("python")
        }

        const typedConfig = config as {
          opacity?: number
          displayConfig?: { opacity?: number }
        }
        const preferredOpacity = typedConfig.displayConfig?.opacity ?? typedConfig.opacity
        if (typeof preferredOpacity === "number") {
          await window.electronAPI.setWindowOpacity(preferredOpacity)
        }

        markInitialized()
      } catch (error) {
        console.error("Failed to initialize app:", error)
        // Fallback to defaults
        updateLanguage("python")
        markInitialized()
      }
    }

    initializeApp()

    // Event listeners for process events
    const onApiKeyInvalid = () => {
      showToast(
        "API Key Invalid",
        "Your configured API key appears invalid or unavailable",
        "error"
      )
      setIsSettingsOpen(true)
    }

    // Setup API key invalid listener
    window.electronAPI.onApiKeyInvalid(onApiKeyInvalid)

    // Define a no-op handler for solution success
    const unsubscribeSolutionSuccess = window.electronAPI.onSolutionSuccess(
      () => {
        console.log("Solution success - no credits deducted in this version")
        // No credit deduction in this version
      }
    )

    // Cleanup function
    return () => {
      window.electronAPI.removeListener("API_KEY_INVALID", onApiKeyInvalid)
      unsubscribeSolutionSuccess()
      setIsInitialized(false)
    }
  }, [updateCredits, updateLanguage, markInitialized, showToast])

  // Wizard handlers
  const handleWizardComplete = useCallback(async (config: Partial<AppConfig>, mode: WizardMode) => {
    try {
      // Save all config updates
      await window.electronAPI.updateConfig(config)

      // Mark wizard as completed
      await window.electronAPI.completeWizard(mode)

      setWizardCompleted(true)
      setHasApiKey(true)
      setShowWizard(false)

      showToast("Success", "Setup completed! Welcome to Interview Assistant.", "success")

      // Reload to apply all settings
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error("Failed to complete wizard:", error)
      showToast("Error", "Failed to save settings", "error")
    }
  }, [showToast])

  const handleWizardSkip = useCallback(() => {
    // User chose to skip wizard - still mark as completed so we don't show it again
    window.electronAPI.completeWizard('quick').then(() => {
      setWizardCompleted(true)
      setShowWizard(false)

      // If no API key, show settings
      if (!hasApiKey) {
        setIsSettingsOpen(true)
      }
    })
  }, [hasApiKey])

  // API Key dialog management
  const handleOpenSettings = useCallback(() => {
    console.log('Opening settings dialog');
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback((open: boolean) => {
    console.log('Settings dialog state changed:', open);
    setIsSettingsOpen(open);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContext.Provider value={{ showToast }}>
          <ErrorBoundary>
            <Routes>
              <Route path="/debug-live" element={<DebugLive />} />
              <Route path="*" element={
                <div className="relative h-screen overflow-auto">
                  {processingStatus.visible && (
                    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-70 w-[min(520px,90vw)] rounded-xl border border-white/10 bg-black/90 backdrop-blur-md shadow-xl functional-enter">
                      <div className="px-4 py-2.5 text-xs text-white/80">
                        {processingStatus.message}
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-b-xl overflow-hidden">
                        <div
                          className="h-full bg-blue-400 transition-all duration-300"
                          style={{ width: `${processingStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {isInitialized ? (
                    isSettingsOpen ? (
                      <SettingsPage onClose={() => handleCloseSettings(false)} />
                    ) : showWizard ? (
                      <WizardContainer
                        initialMode="quick"
                        onComplete={handleWizardComplete}
                        onSkip={handleWizardSkip}
                      />
                    ) : hasApiKey && wizardCompleted ? (
                      <SubscribedApp
                        credits={credits}
                        currentLanguage={currentLanguage}
                        setLanguage={updateLanguage}
                      />
                    ) : (
                      <WelcomeScreen onOpenSettings={handleOpenSettings} />
                    )
                  ) : (
                    <div className="min-h-screen bg-black flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
                        <p className="text-white/60 text-sm">
                          {t('common.initializing')}
                        </p>
                      </div>
                    </div>
                  )}
                  <UpdateNotification />
                  <DevModeToggle />
                </div>
              } />
            </Routes>
          </ErrorBoundary>



          <Toast
            open={toastState.open}
            onOpenChange={(open) =>
              setToastState((prev) => ({ ...prev, open }))
            }
            variant={toastState.variant}
            duration={1500}
          >
            <ToastTitle>{toastState.title}</ToastTitle>
            <ToastDescription>{toastState.description}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
