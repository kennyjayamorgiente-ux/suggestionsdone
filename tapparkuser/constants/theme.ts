/**
 * Root Color Theme System
 * 
 * This file contains all color definitions for both light and dark modes.
 * Use the `useThemeColors()` hook to access theme colors in components.
 * 
 * To add new colors:
 * 1. Add the color to both `light` and `dark` objects
 * 2. Use `useThemeColors()` hook in your component
 * 3. Access colors via `colors.primary`, `colors.background`, etc.
 */

import { Platform } from 'react-native';

// Root Theme Colors - Complete color palette for the app
export const AppTheme = {
  light: {
    // Primary colors
    primary: '#8A0000',
    primaryDark: '#6A0000',
    primaryLight: '#AA2020',
    
    // Background colors
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB',
    card: '#FFFFFF',
    profileCard: '#E5E5E5', // Darker gray for profile cards
    cardBorder: '#E5E7EB',
    
    // Text colors
    text: '#11181C',
    textSecondary: '#687076',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',
    
    // UI element colors
    header: '#8A0000',
    headerText: '#FFFFFF',
    divider: '#E5E7EB',
    border: '#D1D5DB',
    
    // Status colors
    success: '#4CAF50',
    error: '#FF4444',
    warning: '#FFA500',
    info: '#2196F3',
    
    // Interactive colors
    button: '#8A0000',
    buttonText: '#FFFFFF',
    buttonSecondary: '#F3F4F6',
    buttonSecondaryText: '#11181C',
    
    // Icon colors
    icon: '#687076',
    iconActive: '#8A0000',
    
    // Drawer/Sidebar
    drawer: '#FFFFFF',
    drawerText: '#8A0000',
    drawerActive: '#8A0000',
    drawerActiveText: '#FFFFFF',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
    shadow: 'rgba(0, 0, 0, 0.1)',
    
    // Gray scale
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
  },
  dark: {
    // Primary colors (maroon theme) - Updated from new palette
    primary: '#800000',              // Base Maroon
    primaryDark: '#cc0000',          // Maroon Dark
    primaryLight: '#ff4444',         // Dark Mode Maroon (lighter)
    
    // Background colors - Updated with new dark mode palette
    background: '#121212',           // Primary Background (Screen Base) - Deep Dark Gray
    backgroundSecondary: '#2C2C2E',  // Profile Card Backdrop - Mid-Tone Dark Gray
    card: '#1E1E1E',                 // Card Surface - Slightly Lighter Dark Gray
    profileCard: '#1E1E1E',          // Profile Card Surface - Same as card in dark mode
    cardBorder: 'rgba(128, 0, 0, 0.25)', // Border (25% maroon)
    
    // Text colors
    text: '#e8d4d4',                 // Main Text (Light pink/beige)
    textSecondary: '#a68a8a',        // Secondary Text (Muted pink/gray)
    textMuted: '#a68a8a',            // Muted Text
    textInverse: '#1a1a1a',          // Inverse Text
    
    // UI element colors
    header: '#8A0000',               // Nav Background (Same as light mode)
    headerText: '#FFFFFF',           // Header Text (Same as light mode)
    divider: 'rgba(128, 0, 0, 0.2)', // Divider
    border: 'rgba(128, 0, 0, 0.25)', // Border (25% maroon)
    
    // Status colors
    success: '#4CAF50',
    error: '#ff6666',                // Maroon Light (for error/hover states)
    warning: '#FFB84D',
    info: '#4A9EFF',
    
    // Interactive colors
    button: '#661f1f',               // Active State (Medium dark maroon)
    buttonText: '#ffb3b3',           // Active Text (Bright light pink)
    buttonSecondary: '#3a2a2a',
    buttonSecondaryText: '#e8d4d4',
    
    // Icon colors
    icon: '#d4a5a5',                 // Nav Text (Light pink)
    iconActive: '#ffb3b3',           // Active Text (Bright light pink)
    
    // Drawer/Sidebar
    drawer: '#4a1a1a',               // Nav Background (Dark maroon)
    drawerText: '#d4a5a5',           // Nav Text (Light pink)
    drawerActive: '#661f1f',         // Active State (Medium dark maroon)
    drawerActiveText: '#ffb3b3',     // Active Text (Bright light pink)
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
    shadow: 'rgba(128, 0, 0, 0.15)', // Shadow (15% maroon)
    
    // Gray scale - Updated with new palette
    gray: '#666666',                 // Gray
    grayLight: '#999999',            // Gray Light
    gray50: '#2a1f1f',
    gray100: '#3a2a2a',
    gray200: '#4a1a1a',
    gray300: '#5a2525',
    gray400: '#6a2f2f',
    gray500: '#666666',              // Gray
    gray600: '#7a3a3a',
    gray700: '#8a4545',
    gray800: '#999999',              // Gray Light
    gray900: '#aa5a5a',
  },
};

// Legacy Colors export (for backward compatibility)
const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: AppTheme.light.text,
    background: AppTheme.light.background,
    tint: tintColorLight,
    icon: AppTheme.light.icon,
    tabIconDefault: AppTheme.light.icon,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: AppTheme.dark.text,
    background: AppTheme.dark.background,
    tint: tintColorDark,
    icon: AppTheme.dark.icon,
    tabIconDefault: AppTheme.dark.icon,
    tabIconSelected: tintColorDark,
    cardBg: AppTheme.dark.card,
    textMuted: AppTheme.dark.textMuted,
    sidebarBg: AppTheme.dark.drawer,
    sidebarText: AppTheme.dark.drawerText,
    sidebarActive: AppTheme.dark.drawerActive,
    sidebarActiveText: AppTheme.dark.drawerActiveText,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
