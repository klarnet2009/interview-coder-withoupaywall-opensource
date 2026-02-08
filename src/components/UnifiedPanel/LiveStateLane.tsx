import React from "react"
import { stateLabels, stateLane } from "./constants"
import type { ListeningState } from "./types"

interface LiveStateLaneProps {
  state: ListeningState
}

export const LiveStateLane: React.FC<LiveStateLaneProps> = ({ state }) => {
  const activeLaneIndex = stateLane.indexOf(state)

  return (
    <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2.5">
      <div className="text-[13px] text-white/75 mb-2">Live State Lane</div>
      <div className="grid grid-cols-4 gap-1.5">
        {stateLane.map((laneState, index) => {
          const isActiveStep = state === laneState
          const isCompletedStep = activeLaneIndex > -1 && activeLaneIndex > index
          const isIdle = state === "idle"

          return (
            <div
              key={laneState}
              className={`rounded-md border px-2 py-1.5 text-center text-[12px] functional-state-transition ${
                isIdle
                  ? "border-white/10 bg-black/30 text-white/40"
                  : isActiveStep
                    ? "border-blue-400/35 bg-blue-500/15 text-blue-200"
                    : isCompletedStep
                      ? "border-green-400/35 bg-green-500/15 text-green-200"
                      : "border-white/10 bg-black/30 text-white/45"
              }`}
            >
              {stateLabels[laneState]}
            </div>
          )
        })}
      </div>
    </div>
  )
}
