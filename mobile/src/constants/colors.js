/**
 * KKU Dating — Color Theme Constants
 * โทนสีประจำมหาวิทยาลัยขอนแก่น (Crimson Red & Gold)
 */
export const COLORS = {
  // Primary KKU Colors
  primaryKKU: '#8B0000',        // Crimson / Kalapapruek
  primaryKKULight: '#A51C30',
  primaryKKUDark: '#5C0000',

  // Accent Colors
  accentGold: '#FFD700',
  accentOrange: '#FF6B35',

  // Background
  bgDark: '#0F172A',
  bgCard: '#1E293B',
  bgSurface: '#1E293B',
  bgInput: 'rgba(255, 255, 255, 0.08)',

  // Text
  textMain: '#F8FAFC',
  textMuted: '#94A3B8',
  textWhite: '#FFFFFF',

  // Action Colors
  passColor: '#EF4444',
  likeColor: '#10B981',
  superColor: '#3B82F6',

  // Borders
  borderLight: 'rgba(255, 255, 255, 0.1)',
  borderMedium: 'rgba(255, 255, 255, 0.15)',

  // Overlays
  overlayDark: 'rgba(15, 23, 42, 0.95)',
  overlayCard: 'rgba(30, 41, 59, 0.85)',
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 10,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  glow: {
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 8,
  },
};

export const RADIUS = {
  lg: 24,
  md: 14,
  sm: 10,
  full: 999,
};
