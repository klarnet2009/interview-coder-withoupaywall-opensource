/**
 * Design System for Interview Assistant
 * UX Redesign 2025
 * 
 * Dark theme optimized for interview use
 * High contrast, minimal visual noise
 */

// ============================================================================
// Colors
// ============================================================================

export const colors = {
  // Backgrounds
  background: {
    primary: '#000000',
    secondary: '#0a0a0a',
    tertiary: '#111111',
    elevated: '#1a1a1a',
    overlay: 'rgba(0, 0, 0, 0.85)'
  },
  
  // Borders
  border: {
    default: 'rgba(255, 255, 255, 0.1)',
    hover: 'rgba(255, 255, 255, 0.2)',
    active: 'rgba(255, 255, 255, 0.3)',
    error: 'rgba(239, 68, 68, 0.5)',
    success: 'rgba(34, 197, 94, 0.5)'
  },
  
  // Text
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    muted: 'rgba(255, 255, 255, 0.5)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    placeholder: 'rgba(255, 255, 255, 0.4)'
  },
  
  // Status colors
  status: {
    success: '#22c55e',
    successBg: 'rgba(34, 197, 94, 0.1)',
    warning: '#eab308',
    warningBg: 'rgba(234, 179, 8, 0.1)',
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.1)',
    info: '#3b82f6',
    infoBg: 'rgba(59, 130, 246, 0.1)',
    neutral: '#6b7280',
    neutralBg: 'rgba(107, 114, 128, 0.1)'
  },
  
  // Accent colors
  accent: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.8)',
    highlight: 'rgba(255, 255, 255, 0.1)',
    selected: 'rgba(255, 255, 255, 0.15)'
  },
  
  // Provider colors
  provider: {
    gemini: '#4285f4',
    openai: '#10a37f',
    anthropic: '#d4a574'
  }
};

// ============================================================================
// Typography
// ============================================================================

export const typography = {
  fontFamily: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace'
  },
  
  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem' // 30px
  },
  
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75
  }
};

// ============================================================================
// Spacing
// ============================================================================

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem'      // 64px
};

// ============================================================================
// Border Radius
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.375rem',   // 6px
  DEFAULT: '0.5rem', // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  full: '9999px'
};

// ============================================================================
// Shadows
// ============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
  md: '0 6px 12px -2px rgba(0, 0, 0, 0.5)',
  lg: '0 10px 20px -3px rgba(0, 0, 0, 0.6)',
  glow: '0 0 20px rgba(255, 255, 255, 0.1)'
};

// ============================================================================
// Transitions
// ============================================================================

export const transitions = {
  fast: '150ms ease',
  DEFAULT: '250ms ease',
  slow: '350ms ease',
  spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
};

// ============================================================================
// Z-Index Scale
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 50,
  sticky: 100,
  fixed: 200,
  modal: 300,
  tooltip: 400,
  toast: 500
};

// ============================================================================
// Layout
// ============================================================================

export const layout = {
  maxWidth: {
    sm: '400px',
    md: '500px',
    lg: '600px',
    xl: '800px'
  },
  
  minWidth: {
    wizard: '450px',
    dialog: '400px',
    button: '120px'
  }
};

// ============================================================================
// Component-specific styles
// ============================================================================

export const componentStyles = {
  // Button variants
  button: {
    primary: {
      background: colors.text.primary,
      color: colors.background.primary,
      hover: 'rgba(255, 255, 255, 0.9)',
      active: 'rgba(255, 255, 255, 0.8)',
      disabled: 'rgba(255, 255, 255, 0.3)'
    },
    secondary: {
      background: 'transparent',
      color: colors.text.primary,
      border: colors.border.default,
      hover: colors.accent.highlight,
      active: colors.accent.selected
    },
    ghost: {
      background: 'transparent',
      color: colors.text.secondary,
      hover: colors.accent.highlight,
      active: colors.accent.selected
    },
    danger: {
      background: colors.status.errorBg,
      color: colors.status.error,
      hover: 'rgba(239, 68, 68, 0.2)',
      active: 'rgba(239, 68, 68, 0.3)'
    }
  },
  
  // Input styles
  input: {
    background: colors.background.secondary,
    border: colors.border.default,
    focus: colors.border.active,
    placeholder: colors.text.placeholder
  },
  
  // Card styles
  card: {
    background: colors.background.secondary,
    border: colors.border.default,
    hover: colors.border.hover,
    padding: spacing[4]
  },
  
  // Status badge
  badge: {
    success: {
      background: colors.status.successBg,
      color: colors.status.success
    },
    warning: {
      background: colors.status.warningBg,
      color: colors.status.warning
    },
    error: {
      background: colors.status.errorBg,
      color: colors.status.error
    },
    info: {
      background: colors.status.infoBg,
      color: colors.status.info
    }
  }
};

// ============================================================================
// Animation keyframes (for styled-components or CSS-in-JS)
// ============================================================================

export const animations = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  slideUp: `
    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(10px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `
};

// ============================================================================
// Utility classes (for Tailwind)
// ============================================================================

export const utilityClasses = {
  // Glass effect
  glass: 'bg-black/80 backdrop-blur-md border border-white/10',
  
  // Hover states
  hoverHighlight: 'hover:bg-white/5 transition-colors',
  hoverScale: 'hover:scale-105 transition-transform',
  
  // Focus states
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-white/30',
  
  // Text truncation
  truncate: 'overflow-hidden text-ellipsis whitespace-nowrap',
  lineClamp2: 'line-clamp-2',
  lineClamp3: 'line-clamp-3',
  
  // Status indicators
  statusDot: 'w-2 h-2 rounded-full',
  statusPulse: 'animate-pulse'
};

// ============================================================================
// Wizard-specific styles
// ============================================================================

export const wizardStyles = {
  container: `
    bg-black/95 backdrop-blur-xl
    border border-white/10
    rounded-2xl
    shadow-2xl
    p-6
    max-w-lg
    w-full
  `,
  
  stepIndicator: {
    active: 'bg-white text-black',
    completed: 'bg-white/20 text-white',
    pending: 'bg-white/5 text-white/40'
  },
  
  navigation: {
    back: 'text-white/60 hover:text-white transition-colors',
    next: 'bg-white text-black px-6 py-2.5 rounded-xl font-medium hover:bg-white/90 transition-colors',
    skip: 'text-white/40 hover:text-white/60 transition-colors text-sm'
  }
};

// ============================================================================
// StatusBar styles
// ============================================================================

export const statusBarStyles = {
  container: `
    flex items-center justify-between
    px-4 py-2
    bg-black/50 backdrop-blur-sm
    border-b border-white/10
    text-sm
  `,
  
  item: {
    base: 'flex items-center gap-2 text-white/70',
    active: 'text-white',
    error: 'text-red-400'
  },
  
  indicator: {
    good: 'w-2 h-2 rounded-full bg-green-500',
    warning: 'w-2 h-2 rounded-full bg-yellow-500',
    error: 'w-2 h-2 rounded-full bg-red-500',
    loading: 'w-2 h-2 rounded-full bg-blue-500 animate-pulse'
  }
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  layout,
  componentStyles,
  animations,
  utilityClasses,
  wizardStyles,
  statusBarStyles
};
