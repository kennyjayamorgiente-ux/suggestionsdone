import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import SharedHeader from '../../components/SharedHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeColors, useTheme } from '../../contexts/ThemeContext';
import { useLoading } from '../../contexts/LoadingContext';
import { SvgXml } from 'react-native-svg';
import { 
  tapParkLogoSvg,
  maroonLocationIconSvg,
  maroonTimeIconSvg,
  maroonDebitIconSvg,
  maroonArrowToTopRightIconSvg,
  maroonArrowToBottomLeftIconSvg,
  maroonProfitHandIconSvg
} from '../assets/icons/index2';
import { ApiService } from '../../services/api';
import { useScreenDimensions } from '../../hooks/use-screen-dimensions';
import { getBalanceScreenStyles } from '../styles/balanceScreenStyles';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive calculations
// Enhanced responsive calculations
const isSmallScreen = screenWidth < 375;
const isMediumScreen = screenWidth >= 375 && screenWidth < 414;
const isLargeScreen = screenWidth >= 414 && screenWidth < 768;
const isTablet = screenWidth >= 768 && screenWidth < 1024;
const isLargeTablet = screenWidth >= 1024;

const getResponsiveFontSize = (baseSize: number) => {
  if (isSmallScreen) return baseSize * 0.85;
  if (isMediumScreen) return baseSize * 0.95;
  if (isLargeScreen) return baseSize;
  if (isTablet) return baseSize * 1.1;
  if (isLargeTablet) return baseSize * 1.2;
  return baseSize;
};

const getResponsiveSize = (baseSize: number) => {
  if (isSmallScreen) return baseSize * 0.8;
  if (isMediumScreen) return baseSize * 0.9;
  if (isLargeScreen) return baseSize;
  if (isTablet) return baseSize * 1.05;
  if (isLargeTablet) return baseSize * 1.1;
  return baseSize;
};

const getResponsivePadding = (basePadding: number) => {
  if (isSmallScreen) return basePadding * 0.8;
  if (isMediumScreen) return basePadding * 0.9;
  if (isLargeScreen) return basePadding;
  if (isTablet) return basePadding * 1.1;
  if (isLargeTablet) return basePadding * 1.2;
  return basePadding;
};

const getResponsiveMargin = (baseMargin: number) => {
  if (isSmallScreen) return baseMargin * 0.8;
  if (isMediumScreen) return baseMargin * 0.9;
  if (isLargeScreen) return baseMargin;
  if (isTablet) return baseMargin * 1.1;
  if (isLargeTablet) return baseMargin * 1.2;
  return baseMargin;
};


// Helper function to format decimal hours to HH.MM format (e.g., 83.5 -> "83.30")
const formatHoursToHHMM = (decimalHours: number): string => {
  if (!decimalHours || decimalHours === 0) return '0.00';
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}.${minutes.toString().padStart(2, '0')}`;
};

const BalanceScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const { isDarkMode } = useTheme();
  const { showLoading, hideLoading } = useLoading();
  const screenDimensions = useScreenDimensions();
  const balanceScreenStyles = getBalanceScreenStyles(colors);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [subscriptionBalance, setSubscriptionBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Profile picture component
  const ProfilePicture = ({ size = 120 }: { size?: number }) => {
    const getInitials = () => {
      if (!user) return '?';
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const profileImageUrl = user?.profile_image || (user as any)?.profile_image_url;

    // If profile image URL is provided, show the image
    if (profileImageUrl) {
      return (
        <View style={[balanceScreenStyles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
          <ExpoImage
            source={{ uri: profileImageUrl }}
            style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            onError={({ error }) => {
              console.warn('⚠️ Failed to load profile image (BalanceScreen):', profileImageUrl, error);
            }}
          />
        </View>
      );
    }

    // Fallback to initials
    return (
      <View style={[balanceScreenStyles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[balanceScreenStyles.profileInitials, { fontSize: size * 0.3 }]}>
          {getInitials()}
        </Text>
      </View>
    );
  };

  // Load user profile and transactions from API
  const loadBalanceData = async () => {
    try {
      setIsLoading(true);
      
      // Load user profile
      const profileResponse = await ApiService.getProfile();
      if (profileResponse.success) {
        setUserProfile(profileResponse.data.user);
      }

      // Load subscription balance
      const subscriptionResponse = await ApiService.getSubscriptionBalance();
      if (subscriptionResponse.success) {
        setSubscriptionBalance(subscriptionResponse.data);
      }

      // Load payment history (transactions) using AJAX
      console.log('🔄 Loading payment history...');
      const transactionsResponse = await ApiService.getPaymentHistory(1, 20);
      console.log('📊 Transactions response:', transactionsResponse);
      
      if (transactionsResponse.success) {
        console.log('✅ Transactions loaded successfully');
        console.log('📋 Number of transactions:', transactionsResponse.data.payments?.length || 0);
        console.log('📋 First transaction:', transactionsResponse.data.payments?.[0]);
        
        // Debug each transaction to check for number_of_hours
        if (transactionsResponse.data.payments?.length > 0) {
          transactionsResponse.data.payments.forEach((transaction, index) => {
            console.log(`🔍 Transaction ${index + 1}:`, {
              payment_id: transaction.payment_id,
              plan_name: transaction.location_name,
              number_of_hours: transaction.number_of_hours,
              cost: transaction.cost,
              amount: transaction.amount,
              payment_type: transaction.payment_type
            });
          });
        }
        
        setTransactions(transactionsResponse.data.payments || []);
      } else {
        console.error('❌ Failed to load transactions:', transactionsResponse.message);
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading balance data:', error);
      Alert.alert('Error', 'Failed to load balance information');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadBalanceData();
    }, [])
  );

  // Format transaction amount for display
  const formatTransactionAmount = (transaction: any) => {
    console.log('Transaction data:', { 
      payment_id: transaction.payment_id,
      payment_type: transaction.payment_type,
      subscription_id: transaction.subscription_id,
      plan_name: transaction.plan_name,
      number_of_hours: transaction.number_of_hours,
      amount: transaction.amount
    });
    
    if (transaction.type === 'parking') {
      // For parking sessions, show hours deducted
      const hoursDeducted = transaction.hours_deducted || 0;
      return `- ${formatHoursToHHMM(hoursDeducted)} hrs`;
    } else if (transaction.payment_type === 'subscription') {
      // For subscription purchases - RELY ON number_of_hours from plans table
      const hours = transaction.number_of_hours;
      if (!hours) {
        console.warn('⚠️ number_of_hours is missing from transaction:', transaction.payment_id);
        return '+ 0 hrs (data missing)';
      }
      return `+ ${hours} hrs`;
    } else {
      // Other payment types
      return `- ${transaction.amount || 0}`;
    }
  };

  // Get subscription plan name
  const getSubscriptionPlanName = (transaction: any) => {
    return transaction.subscription_plan_name || transaction.plan_name || 'Subscription Plan';
  };

  // Get transaction icon based on type
  const getTransactionIcon = (transaction: any) => {
    if (transaction.type === 'parking') {
      return maroonArrowToTopRightIconSvg; // Parking consumes hours
    } else {
      return transaction.payment_type === 'subscription' ? maroonArrowToBottomLeftIconSvg : maroonArrowToTopRightIconSvg;
    }
  };

  // Handle transaction selection and open modal
  const handleTransactionPress = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionModalVisible(true);
  };

  // Close transaction modal
  const closeTransactionModal = () => {
    setIsTransactionModalVisible(false);
    setSelectedTransaction(null);
  };

  // Format transaction date
  const formatTransactionDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get transaction status color
  const getTransactionStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'failed':
      case 'cancelled':
        return '#F44336';
      default:
        return '#8A0000';
    }
  };

  return (
    <View style={balanceScreenStyles.container}>
      <SharedHeader 
        title="Balance" 
        showBackButton={true}
        onBackPress={() => {
          showLoading();
          router.back();
          setTimeout(() => hideLoading(), 500);
        }}
      />
      
      <ScrollView 
        style={balanceScreenStyles.scrollContainer}
        contentContainerStyle={balanceScreenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Profile Card */}
        <View style={balanceScreenStyles.profileCard}>
          {/* Profile Picture Section */}
          <View style={balanceScreenStyles.profilePictureSection}>
            <View style={balanceScreenStyles.profilePictureContainer}>
              <ProfilePicture size={screenDimensions.isTablet ? 170 : 150} />
            </View>
            <View style={balanceScreenStyles.userInfoContainer}>
              {isLoading ? (
                <View style={balanceScreenStyles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={balanceScreenStyles.loadingText}>Loading...</Text>
                </View>
              ) : userProfile ? (
                <>
                  <Text style={balanceScreenStyles.userName}>
                    {userProfile.first_name?.toUpperCase()} {userProfile.last_name?.toUpperCase()}
                  </Text>
                  <Text style={balanceScreenStyles.userEmail}>{userProfile.email}</Text>
                </>
              ) : (
                <>
                  <Text style={balanceScreenStyles.userName}>USER</Text>
                  <Text style={balanceScreenStyles.userEmail}>No profile data</Text>
                </>
              )}
            </View>
          </View>

          {/* Scrollable Content Area */}
          <ScrollView 
            style={balanceScreenStyles.profileContentScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Debit Card Container */}
            <View style={balanceScreenStyles.debitCardContainer}>
            {/* TapPark Logo - Top Right */}
            <View style={balanceScreenStyles.topRightLogo}>
              <SvgXml 
                xml={tapParkLogoSvg}
                width={getResponsiveSize(70)}
                height={getResponsiveSize(70)}
              />
            </View>

            {/* Owner Name */}
            <View style={balanceScreenStyles.ownerNameSection}>
              <Text style={balanceScreenStyles.ownerNameText}>
                {userProfile ? `${userProfile.first_name?.toUpperCase()} ${userProfile.last_name?.toUpperCase()}` : 'USER'}
              </Text>
            </View>

            {/* Student ID Section */}
            <View style={balanceScreenStyles.studentIdSection}>
              <View style={balanceScreenStyles.studentIdInfo}>
                <Text style={balanceScreenStyles.studentIdLabel}>STUDENT ID</Text>
                <Text style={balanceScreenStyles.studentIdText}>
                  {userProfile?.external_user_id || 'N/A'}
                </Text>
              </View>
            </View>

            {/* Balance Section */}
            <View style={balanceScreenStyles.balanceSection}>
              <View style={balanceScreenStyles.balanceInfo}>
                <SvgXml 
                  xml={maroonTimeIconSvg}
                  width={getResponsiveSize(32)}
                  height={getResponsiveSize(32)}
                />
                <Text style={balanceScreenStyles.balanceText}>
                  {subscriptionBalance ? `${subscriptionBalance.total_hours_remaining || 0} hrs` : '0 hrs'}
                </Text>
              </View>
              <TouchableOpacity 
                style={balanceScreenStyles.topUpButton}
                onPress={() => router.push('/screens/TopUpScreen')}
              >
                <Text style={balanceScreenStyles.topUpText}>+ ADD HOURS</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Transactions Section */}
          <View style={balanceScreenStyles.transactionsSection}>
            <View style={balanceScreenStyles.transactionsHeader}>
              <SvgXml 
                xml={maroonProfitHandIconSvg}
                width={getResponsiveSize(20)}
                height={getResponsiveSize(20)}
              />
              <Text style={balanceScreenStyles.transactionsTitle}>Transactions:</Text>
            </View>
            
            {isLoading ? (
              <View style={balanceScreenStyles.transactionsLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={balanceScreenStyles.transactionsLoadingText}>Loading transactions...</Text>
              </View>
            ) : transactions.length === 0 ? (
              <View style={balanceScreenStyles.emptyTransactionsContainer}>
                <Text style={balanceScreenStyles.emptyTransactionsText}>No transactions found</Text>
                <Text style={balanceScreenStyles.emptyTransactionsSubtext}>Your transaction history will appear here</Text>
                <Text style={[balanceScreenStyles.emptyTransactionsSubtext, { marginTop: 10, fontSize: 12, color: '#999' }]}>
                  Debug: transactions.length = {transactions.length}
                </Text>
              </View>
            ) : (
              transactions.map((transaction, index) => (
                <TouchableOpacity 
                  key={transaction.payment_id || index} 
                  style={balanceScreenStyles.transactionItem}
                  onPress={() => handleTransactionPress(transaction)}
                  activeOpacity={0.7}
                >
                  <View style={balanceScreenStyles.transactionIconContainer}>
                    <SvgXml 
                      xml={getTransactionIcon(transaction)}
                      width={getResponsiveSize(16)}
                      height={getResponsiveSize(16)}
                    />
                  </View>
                  <View style={balanceScreenStyles.transactionInfo}>
                    <Text style={balanceScreenStyles.transactionAmount}>
                      {formatTransactionAmount(transaction)}
                    </Text>
                    {transaction.payment_type === 'subscription' && (
                      <Text style={balanceScreenStyles.transactionPlanName}>
                        {getSubscriptionPlanName(transaction)}
                      </Text>
                    )}
                  </View>
                  <SvgXml 
                    xml={maroonTimeIconSvg}
                    width={getResponsiveSize(16)}
                    height={getResponsiveSize(16)}
                  />
                </TouchableOpacity>
              ))
            )}
          </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Transaction Details Modal */}
      <Modal
        visible={isTransactionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeTransactionModal}
      >
        <View style={balanceScreenStyles.modalOverlay}>
          <View style={balanceScreenStyles.modalContainer}>
            {/* Modal Header */}
            <View style={balanceScreenStyles.modalHeader}>
              <Text style={balanceScreenStyles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity 
                onPress={closeTransactionModal}
                style={balanceScreenStyles.closeButton}
              >
                <Text style={balanceScreenStyles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {selectedTransaction && (
              <ScrollView style={balanceScreenStyles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Transaction Type */}
                <View style={balanceScreenStyles.detailRow}>
                  <Text style={balanceScreenStyles.detailLabel}>Type:</Text>
                  <View style={balanceScreenStyles.detailValueContainer}>
                    <SvgXml 
                      xml={getTransactionIcon(selectedTransaction)}
                      width={getResponsiveSize(20)}
                      height={getResponsiveSize(20)}
                    />
                    <Text style={balanceScreenStyles.detailValue}>
                      {selectedTransaction.type === 'parking' ? 'Parking Session' : 
                       selectedTransaction.payment_type === 'subscription' ? 'Add Hours' : 'Payment'}
                    </Text>
                  </View>
                </View>

                {/* Subscription Plan Name */}
                {selectedTransaction.payment_type === 'subscription' && (
                  <View style={balanceScreenStyles.detailRow}>
                    <Text style={balanceScreenStyles.detailLabel}>Plan:</Text>
                    <Text style={balanceScreenStyles.detailValue}>
                      {getSubscriptionPlanName(selectedTransaction)}
                    </Text>
                  </View>
                )}

                {/* Amount */}
                <View style={balanceScreenStyles.detailRow}>
                  <Text style={balanceScreenStyles.detailLabel}>Amount:</Text>
                  <Text style={[balanceScreenStyles.detailValue, balanceScreenStyles.amountValue]}>
                    {formatTransactionAmount(selectedTransaction)}
                  </Text>
                </View>

                {/* Date */}
                <View style={balanceScreenStyles.detailRow}>
                  <Text style={balanceScreenStyles.detailLabel}>Date:</Text>
                  <Text style={balanceScreenStyles.detailValue}>
                    {formatTransactionDate(selectedTransaction.created_at || selectedTransaction.date)}
                  </Text>
                </View>

                {/* Status */}
                {selectedTransaction.status && (
                  <View style={balanceScreenStyles.detailRow}>
                    <Text style={balanceScreenStyles.detailLabel}>Status:</Text>
                    <Text style={[balanceScreenStyles.detailValue, { color: getTransactionStatusColor(selectedTransaction.status) }]}>
                      {selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                    </Text>
                  </View>
                )}

                {/* Transaction ID */}
                {selectedTransaction.payment_id && (
                  <View style={balanceScreenStyles.detailRow}>
                    <Text style={balanceScreenStyles.detailLabel}>Transaction ID:</Text>
                    <Text style={[balanceScreenStyles.detailValue, balanceScreenStyles.transactionId]}>
                      {selectedTransaction.payment_id}
                    </Text>
                  </View>
                )}

                {/* Parking Details */}
                {selectedTransaction.type === 'parking' && (
                  <>
                    {selectedTransaction.location_name && (
                      <View style={balanceScreenStyles.detailRow}>
                        <Text style={balanceScreenStyles.detailLabel}>Location:</Text>
                        <Text style={balanceScreenStyles.detailValue}>{selectedTransaction.location_name}</Text>
                      </View>
                    )}
                    {selectedTransaction.spot_number && (
                      <View style={balanceScreenStyles.detailRow}>
                        <Text style={balanceScreenStyles.detailLabel}>Spot:</Text>
                        <Text style={balanceScreenStyles.detailValue}>{selectedTransaction.spot_number}</Text>
                      </View>
                    )}
                    {selectedTransaction.hours_deducted && (
                      <View style={balanceScreenStyles.detailRow}>
                        <Text style={balanceScreenStyles.detailLabel}>Hours Used:</Text>
                        <Text style={balanceScreenStyles.detailValue}>{formatHoursToHHMM(selectedTransaction.hours_deducted)} hours</Text>
                      </View>
                    )}
                  </>
                )}

                {/* Payment Details */}
                {selectedTransaction.type !== 'parking' && (
                  <>
                    {selectedTransaction.payment_method && (
                      <View style={balanceScreenStyles.detailRow}>
                        <Text style={balanceScreenStyles.detailLabel}>Payment Method:</Text>
                        <Text style={balanceScreenStyles.detailValue}>{selectedTransaction.payment_method}</Text>
                      </View>
                    )}
                    {selectedTransaction.reference_number && (
                      <View style={balanceScreenStyles.detailRow}>
                        <Text style={balanceScreenStyles.detailLabel}>Reference:</Text>
                        <Text style={[balanceScreenStyles.detailValue, balanceScreenStyles.transactionId]}>
                          {selectedTransaction.reference_number}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {/* Description */}
                {selectedTransaction.description && (
                  <View style={balanceScreenStyles.detailRow}>
                    <Text style={balanceScreenStyles.detailLabel}>Description:</Text>
                    <Text style={balanceScreenStyles.detailValue}>{selectedTransaction.description}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={balanceScreenStyles.modalFooter}>
              <TouchableOpacity 
                style={balanceScreenStyles.modalCloseButton}
                onPress={closeTransactionModal}
              >
                <Text style={balanceScreenStyles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Styles are now in balanceScreenStyles.ts

export default BalanceScreen;
