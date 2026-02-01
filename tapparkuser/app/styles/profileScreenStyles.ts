import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Type for theme colors
type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  card: string;
  profileCard: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  border: string;
  shadow: string;
  overlay: string;
  success: string;
  error: string;
  warning: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;
};

// Enhanced responsive calculation functions - keeping same layout, just making it adaptive
const isSmallScreen = screenWidth < 375;
const isMediumScreen = screenWidth >= 375 && screenWidth < 414;
const isLargeScreen = screenWidth >= 414 && screenWidth < 768;
const isTablet = screenWidth >= 768 && screenWidth < 1024;
const isLargeTablet = screenWidth >= 1024;

const getResponsiveFontSize = (size: number): number => {
  if (isSmallScreen) return size * 0.85;
  if (isMediumScreen) return size * 0.95;
  if (isLargeScreen) return size;
  if (isTablet) return size * 1.1;
  if (isLargeTablet) return size * 1.2;
  return size;
};

const getResponsiveSize = (size: number): number => {
  if (isSmallScreen) return size * 0.8;
  if (isMediumScreen) return size * 0.9;
  if (isLargeScreen) return size;
  if (isTablet) return size * 1.05;
  if (isLargeTablet) return size * 1.1;
  return size;
};

const getResponsivePadding = (size: number): number => {
  if (isSmallScreen) return size * 0.8;
  if (isMediumScreen) return size * 0.9;
  if (isLargeScreen) return size;
  if (isTablet) return size * 1.1;
  if (isLargeTablet) return size * 1.2;
  return size;
};

const getResponsiveMargin = (size: number): number => {
  if (isSmallScreen) return size * 0.8;
  if (isMediumScreen) return size * 0.9;
  if (isLargeScreen) return size;
  if (isTablet) return size * 1.1;
  if (isLargeTablet) return size * 1.2;
  return size;
};

export const getProfileScreenStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 0, // Remove any top padding that might push content down
  },
  scrollContainer: {
    flex: 1,
  },
  backgroundSection: {
    height: screenHeight * 0.3,
    position: 'relative',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  profileCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.profileCard,
    borderTopLeftRadius: getResponsiveSize(20),
    borderTopRightRadius: getResponsiveSize(20),
    borderWidth: 0,
    borderColor: 'transparent',
    paddingTop: getResponsivePadding(25),
    paddingBottom: 0,
    paddingHorizontal: getResponsivePadding(20),
    height: screenHeight * 0.80,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: getResponsiveSize(8),
    elevation: 8,
    zIndex: 2,
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: getResponsivePadding(25),
  },
  profilePictureContainer: {
    position: 'relative',
    marginTop: -getResponsiveSize(70),
    marginBottom: getResponsivePadding(15),
    backgroundColor: 'transparent',
    borderRadius: getResponsiveSize(90),
    width: getResponsiveSize(200),
    height: getResponsiveSize(200),
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicture: {
    width: getResponsiveSize(120),
    height: getResponsiveSize(120),
    borderRadius: getResponsiveSize(60),
    backgroundColor: colors.primary,
    borderWidth: getResponsiveSize(3),
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: colors.textInverse,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  profilePictureImage: {
    borderRadius: getResponsiveSize(60),
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: getResponsiveSize(32),
    height: getResponsiveSize(32),
    borderRadius: getResponsiveSize(16),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: getResponsiveSize(3),
    borderColor: 'white',
  },
  userName: {
    fontSize: getResponsiveFontSize(28),
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: getResponsivePadding(8),
  },
  userEmail: {
    fontSize: getResponsiveFontSize(18),
    color: colors.textSecondary,
  },
  menuContainer: {
    marginBottom: getResponsivePadding(25),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: getResponsivePadding(18),
    paddingHorizontal: getResponsivePadding(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.gray500 || '#6B7280',
    backgroundColor: colors.profileCard,
    borderRadius: getResponsiveSize(8),
    marginBottom: getResponsiveMargin(8),
  },
  menuItemText: {
    fontSize: getResponsiveFontSize(18),
    color: colors.primary,
    marginLeft: getResponsivePadding(15),
    fontWeight: '500',
  },
  helpButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getResponsivePadding(20),
    paddingHorizontal: getResponsivePadding(35),
    borderRadius: getResponsiveSize(25),
    shadowColor: '#8A0000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: getResponsiveSize(4),
    elevation: 5,
  },
  helpButtonText: {
    color: colors.textInverse,
    fontSize: getResponsiveFontSize(18),
    fontWeight: '600',
    marginLeft: getResponsivePadding(10),
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getResponsivePadding(20),
  },
  loadingText: {
    fontSize: getResponsiveFontSize(16),
    color: colors.primary,
    marginTop: getResponsiveMargin(8),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: getResponsiveSize(16),
    padding: getResponsivePadding(24),
    width: screenWidth * 0.85,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: getResponsiveSize(8),
    elevation: 10,
  },
  modalTitle: {
    fontSize: getResponsiveFontSize(22),
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: getResponsiveMargin(8),
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: getResponsiveFontSize(16),
    color: colors.textSecondary,
    marginBottom: getResponsiveMargin(20),
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: colors.primary,
    width: '100%',
    paddingVertical: getResponsivePadding(14),
    paddingHorizontal: getResponsivePadding(20),
    borderRadius: getResponsiveSize(8),
    marginBottom: getResponsiveMargin(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: colors.textInverse,
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
  },
  modalButtonRemove: {
    backgroundColor: 'transparent',
    width: '100%',
    paddingVertical: getResponsivePadding(14),
    paddingHorizontal: getResponsivePadding(20),
    borderRadius: getResponsiveSize(8),
    marginBottom: getResponsiveMargin(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  modalButtonTextRemove: {
    color: colors.error,
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
  },
  modalCancelButton: {
    width: '100%',
    paddingVertical: getResponsivePadding(14),
    paddingHorizontal: getResponsivePadding(20),
    borderRadius: getResponsiveSize(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: getResponsiveMargin(8),
  },
  modalCancelButtonText: {
    color: colors.textSecondary,
    fontSize: getResponsiveFontSize(16),
    fontWeight: '500',
  },
  
  // Rating Modal Styles
  ratingModalContainer: {
    width: '90%',
    maxWidth: getResponsiveSize(400),
    backgroundColor: colors.card,
    borderRadius: getResponsiveSize(20),
    padding: getResponsivePadding(24),
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: getResponsiveSize(10) },
    shadowOpacity: 0.25,
    shadowRadius: getResponsiveSize(20),
    elevation: 10,
  },
  ratingModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: getResponsiveMargin(20),
  },
  ratingModalTitle: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  ratingModalCloseButton: {
    fontSize: getResponsiveFontSize(24),
    color: colors.textSecondary,
    fontWeight: '300',
    padding: getResponsivePadding(8),
  },
  ratingStarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: getResponsiveMargin(20),
    gap: getResponsiveSize(12),
  },
  starButton: {
    padding: getResponsivePadding(8),
  },
  ratingLabel: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: getResponsiveMargin(20),
    textAlign: 'center',
  },
  feedbackContainer: {
    width: '100%',
    marginBottom: getResponsiveMargin(24),
  },
  feedbackLabel: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '500',
    color: colors.text,
    marginBottom: getResponsiveMargin(8),
  },
  feedbackInput: {
    width: '100%',
    minHeight: getResponsiveSize(80),
    backgroundColor: colors.backgroundSecondary,
    borderRadius: getResponsiveSize(12),
    padding: getResponsivePadding(16),
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackText: {
    fontSize: getResponsiveFontSize(14),
    color: colors.textSecondary,
    textAlignVertical: 'top',
  },
  ratingModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: getResponsiveSize(12),
  },
  ratingModalCancelButton: {
    flex: 1,
    paddingVertical: getResponsivePadding(14),
    paddingHorizontal: getResponsivePadding(20),
    borderRadius: getResponsiveSize(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingModalCancelButtonText: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  ratingModalSubmitButton: {
    flex: 1,
    paddingVertical: getResponsivePadding(14),
    paddingHorizontal: getResponsivePadding(20),
    borderRadius: getResponsiveSize(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  ratingModalSubmitButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  ratingModalSubmitButtonText: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
    color: colors.textInverse,
  },
});

// Export default styles for backward compatibility (light theme)
export const profileScreenStyles = getProfileScreenStyles({
  background: '#383838',
  backgroundSecondary: '#2C2C2E',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  textMuted: '#999999',
  textInverse: '#FFFFFF',
  primary: '#8A0000',
  primaryDark: '#800000',
  primaryLight: '#ff4444',
  border: '#F0F0F0',
  shadow: '#000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  success: '#4CAF50',
  error: '#FF4444',
  warning: '#FFA500',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#E0E0E0',
  gray400: '#CCCCCC',
  gray500: '#999999',
  gray600: '#666666',
  gray700: '#4B5563',
  gray800: '#374151',
  gray900: '#1F2937',
} as ThemeColors);







