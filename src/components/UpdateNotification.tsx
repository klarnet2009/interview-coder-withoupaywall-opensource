import React, { useEffect, useState } from "react"
import { Dialog, DialogContent } from "./ui/dialog"
import { Button } from "./ui/button"
import { useToast } from "../contexts/toast"

export const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    console.log("UpdateNotification: Setting up event listeners")

    const unsubscribeAvailable = window.electronAPI.onUpdateAvailable(
      (info: unknown) => {
        console.log("UpdateNotification: Update available received", info)
        setUpdateAvailable(true)
        setDismissed(false)
      }
    )

    const unsubscribeDownloaded = window.electronAPI.onUpdateDownloaded(
      (info: unknown) => {
        console.log("UpdateNotification: Update downloaded received", info)
        setUpdateDownloaded(true)
        setIsDownloading(false)
        setDismissed(false)
      }
    )

    return () => {
      console.log("UpdateNotification: Cleaning up event listeners")
      unsubscribeAvailable()
      unsubscribeDownloaded()
    }
  }, [])

  const handleStartUpdate = async () => {
    console.log("UpdateNotification: Starting update download")
    setIsDownloading(true)
    const result = await window.electronAPI.startUpdate()
    console.log("UpdateNotification: Update download result", result)
    if (!result.success) {
      setIsDownloading(false)
      showToast("Error", "Failed to download update", "error")
    }
  }

  const handleInstallUpdate = () => {
    console.log("UpdateNotification: Installing update")
    window.electronAPI.installUpdate()
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  if (dismissed || (!updateAvailable && !updateDownloaded)) return null

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) setDismissed(true) }}>
      <DialogContent
        className="bg-zinc-950/95 text-white border-white/20 p-5 rounded-2xl shadow-2xl backdrop-blur-xl max-w-sm"
      >
        <div>
          <h2 className="text-base font-semibold text-white mb-2">
            {updateDownloaded
              ? "Update Ready to Install"
              : "A New Version is Available"}
          </h2>
          <p className="text-xs text-white/70 mb-5 leading-relaxed">
            {updateDownloaded
              ? "The update has been downloaded and is ready to install. Restart the app whenever you're ready."
              : "A new version of Interview Coder is available with improvements and fixes."}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={handleDismiss}
            >
              Remind Me Later
            </Button>
            {updateDownloaded ? (
              <Button onClick={handleInstallUpdate}>
                Restart & Install
              </Button>
            ) : (
              <Button onClick={handleStartUpdate} disabled={isDownloading}>
                {isDownloading ? "Downloading..." : "Download Update"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UpdateNotification
