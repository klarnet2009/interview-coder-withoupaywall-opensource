import React from 'react';
import { GripHorizontal } from 'lucide-react';

interface DragHandleProps {
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
}

/**
 * Draggable handle for frameless Electron window
 * Uses -webkit-app-region: drag to enable window dragging
 */
export const DragHandle: React.FC<DragHandleProps> = ({
  className = '',
  showIcon = true,
  children
}) => {
  return (
    <div
      className={`
        flex items-center justify-center
        h-6 bg-white/[0.03] hover:bg-white/[0.05]
        border-b border-white/5
        cursor-grab active:cursor-grabbing
        transition-colors
        ${className}
      `}
      style={{ 
        WebkitAppRegion: 'drag',
        appRegion: 'drag'
      } as React.CSSProperties}
    >
      {children ? (
        children
      ) : showIcon ? (
        <GripHorizontal className="w-4 h-4 text-white/20" />
      ) : null}
    </div>
  );
};

/**
 * Full width drag header with window controls
 */
interface DragHeaderProps {
  title?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  className?: string;
}

export const DragHeader: React.FC<DragHeaderProps> = ({
  title,
  onClose,
  onMinimize,
  className = ''
}) => {
  return (
    <div
      className={`
        flex items-center justify-between
        px-4 py-2
        bg-white/[0.02] border-b border-white/5
        ${className}
      `}
      style={{ 
        WebkitAppRegion: 'drag',
        appRegion: 'drag'
      } as React.CSSProperties}
    >
      {/* Left: Drag indicator */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as React.CSSProperties}>
        <GripHorizontal className="w-4 h-4 text-white/20" />
        {title && (
          <span className="text-xs font-medium text-white/40">{title}</span>
        )}
      </div>

      {/* Center: Empty space for dragging */}
      <div className="flex-1" />

      {/* Right: Window controls */}
      <div 
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as React.CSSProperties}
      >
        {onMinimize && (
          <button
            onClick={onMinimize}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
            title="Minimize"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12">
              <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
            </svg>
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
            title="Close"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12">
              <path
                d="M1 1L11 11M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Simple drag area that takes full width
 */
export const DragArea: React.FC<{ className?: string; height?: string }> = ({
  className = '',
  height = 'h-6'
}) => {
  return (
    <div
      className={`
        w-full ${height}
        bg-gradient-to-b from-white/[0.05] to-transparent
        hover:from-white/[0.08]
        cursor-grab active:cursor-grabbing
        flex items-center justify-center
        transition-all
        ${className}
      `}
      style={{ 
        WebkitAppRegion: 'drag',
        appRegion: 'drag'
      } as React.CSSProperties}
    >
      <div className="w-12 h-1 rounded-full bg-white/10" />
    </div>
  );
};

export default DragHandle;
