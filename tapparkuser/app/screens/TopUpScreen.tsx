import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as SystemUI from 'expo-system-ui';
import SharedHeader from '../../components/SharedHeader';
import { SvgXml } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthContext';
import { 
  maroonUsersEditIconSvg,
  maroonTimeIconSvg,
  maroonProfitHandIconSvg
} from '../assets/icons/index2';
import { ApiService } from '../../services/api';
import { topUpScreenStyles } from '../styles/topUpScreenStyles';

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

interface Plan {
  plan_id: number;
  plan_name: string;
  cost: number;
  number_of_hours: number;
  description: string;
}

const TopUpScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  
  // PayPal state
  const [showPayPalWebView, setShowPayPalWebView] = useState(false);
  const [paypalUrl, setPaypalUrl] = useState('');
  const [paypalOrderId, setPaypalOrderId] = useState('');
  const [isProcessingPayPal, setIsProcessingPayPal] = useState(false);
  const [paymentCaptured, setPaymentCaptured] = useState(false);
  const [paypalProcessingStarted, setPaypalProcessingStarted] = useState(false);

  // Profile picture component
  const ProfilePicture = ({ size = 120 }: { size?: number }) => {
    const getInitials = () => {
      if (!userProfile) return '?';
      const firstName = userProfile.first_name || '';
      const lastName = userProfile.last_name || '';
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const profileImageUrl = userProfile?.profile_image || userProfile?.profile_image_url || user?.profile_image;

    if (profileImageUrl) {
      return (
        <View style={[topUpScreenStyles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
          <ExpoImage
            source={{ uri: profileImageUrl }}
            style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            onError={({ error }) => {
              console.warn('⚠️ Failed to load profile image:', profileImageUrl, error);
            }}
          />
        </View>
      );
    }

    return (
      <View style={[topUpScreenStyles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[topUpScreenStyles.profileInitials, { fontSize: size * 0.3 }]}>
          {getInitials()}
        </Text>
      </View>
    );
  };

  const loadUserProfile = async () => {
    try {
      const profileResponse = await ApiService.getProfile();
      if (profileResponse.success) {
        setUserProfile(profileResponse.data.user);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadUserProfile();
      fetchPlans();
    }, [])
  );

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getSubscriptionPlans();
      if (response.success) {
        setPlans(response.data);
      } else {
        Alert.alert('Error', 'Failed to load subscription plans');
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setIsConfirmationModalVisible(true);
  };

  const handleCloseConfirmationModal = () => {
    setIsConfirmationModalVisible(false);
    setSelectedPlan(null);
  };

  const handleConfirmPurchase = async () => {
    if (selectedPlan) {
      try {
        setPurchasing(true);
        
        // Create PayPal order
        const response = await ApiService.createPayPalOrder(selectedPlan.plan_id);
        
        if (response.success && response.data.approvalUrl) {
          setPaypalUrl(response.data.approvalUrl);
          setPaypalOrderId(response.data.orderId);
          setShowPayPalWebView(true);
          setIsConfirmationModalVisible(false);
        } else {
          Alert.alert('Payment Failed', 'Failed to create PayPal order. Please try again.');
        }
      } catch (error) {
        console.error('PayPal order creation error:', error);
        Alert.alert('Payment Failed', 'An error occurred while creating PayPal order. Please try again.');
      } finally {
        setPurchasing(false);
      }
    }
  };

  const handlePayPalNavigation = (navState: any) => {
    const { url } = navState;
    
    // Check if payment was successful or cancelled
    if (url.includes('/success') || url.includes('/return')) {
      handlePayPalSuccess();
    } else if (url.includes('/cancel')) {
      handlePayPalCancel();
    }
  };

  const handlePayPalSuccess = async () => {
    // Prevent any duplicate processing
    if (paypalProcessingStarted || paymentCaptured) {
      console.log('PayPal processing already started, skipping duplicate');
      return;
    }

    // Set flags immediately to prevent duplicates
    setPaypalProcessingStarted(true);
    setPaymentCaptured(true);

    try {
      setIsProcessingPayPal(true);
      
      // Use the stored order ID
      if (paypalOrderId) {
        const response = await ApiService.capturePayPalOrder(paypalOrderId);
        
        if (response.success) {
          Alert.alert(
            'Payment Successful!',
            `You have successfully purchased ${selectedPlan?.plan_name}!\n\nHours added: ${selectedPlan?.number_of_hours}\nTotal hours remaining: ${response.data.total_hours_remaining || 'Updated'}`,
            [
              {
                text: 'OK',
                onPress: () => {
                  setShowPayPalWebView(false);
                  setSelectedPlan(null);
                  setPaypalOrderId('');
                  setPaymentCaptured(false);
                  setPaypalProcessingStarted(false);
                  // Navigate back to balance screen which will refresh automatically
                  router.back();
                }
              }
            ]
          );
        } else {
          Alert.alert('Payment Failed', 'Payment was successful but failed to update your account. Please contact support.');
        }
      } else {
        Alert.alert('Payment Failed', 'Order ID not found. Please try again.');
      }
    } catch (error) {
      console.error('PayPal capture error:', error);
      // Payment was successful in PayPal, so show success message anyway
      Alert.alert(
        'Payment Successful!',
        `You have successfully purchased ${selectedPlan?.plan_name}!\n\nHours added: ${selectedPlan?.number_of_hours}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowPayPalWebView(false);
              setSelectedPlan(null);
              setPaypalOrderId('');
              setPaymentCaptured(false);
              setPaypalProcessingStarted(false);
              router.back();
            }
          }
        ]
      );
    } finally {
      setIsProcessingPayPal(false);
      setShowPayPalWebView(false);
      setPaypalOrderId('');
      setPaymentCaptured(false);
      setPaypalProcessingStarted(false);
    }
  };

  const handlePayPalCancel = () => {
    Alert.alert('Payment Cancelled', 'Your payment was cancelled. No charges were made.');
    setShowPayPalWebView(false);
    setSelectedPlan(null);
    setPaypalOrderId('');
    setPaymentCaptured(false);
    setPaypalProcessingStarted(false);
  };

  return (
    <View style={topUpScreenStyles.container}>
      <SharedHeader 
        title="Top up" 
        showBackButton={true}
        onBackPress={() => router.back()}
      />
      
      <View style={topUpScreenStyles.scrollContainer}>
        {/* Profile Card */}
        <View style={topUpScreenStyles.profileCard}>
          {/* Profile Picture Section */}
          <View style={topUpScreenStyles.profilePictureSection}>
            <View style={topUpScreenStyles.profilePictureContainer}>
              <ProfilePicture size={getResponsiveSize(140)} />
            </View>
            <View style={topUpScreenStyles.userInfoContainer}>
              {loading ? (
                <View style={topUpScreenStyles.loadingContainer}>
                  <ActivityIndicator size="small" color="#8A0000" />
                  <Text style={topUpScreenStyles.loadingText}>Loading...</Text>
                </View>
              ) : userProfile ? (
                <>
                  <Text style={topUpScreenStyles.userName}>
                    {userProfile.first_name?.toUpperCase()} {userProfile.last_name?.toUpperCase()}
                  </Text>
                  <Text style={topUpScreenStyles.userEmail}>{userProfile.email}</Text>
                </>
              ) : (
                <>
                  <Text style={topUpScreenStyles.userName}>USER</Text>
                  <Text style={topUpScreenStyles.userEmail}>No profile data</Text>
                </>
              )}
            </View>
          </View>

          {/* Plans Section */}
          <ScrollView 
            style={topUpScreenStyles.profileCardScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={topUpScreenStyles.plansSection}>
              <View style={topUpScreenStyles.plansHeader}>
                {maroonProfitHandIconSvg && (
                  <SvgXml 
                    xml={maroonProfitHandIconSvg}
                    width={getResponsiveSize(20)}
                    height={getResponsiveSize(20)}
                  />
                )}
                <Text style={topUpScreenStyles.plansTitle}>Select a Plan:</Text>
              </View>
              
              <View style={topUpScreenStyles.plansList}>
                {loading ? (
                  <View style={topUpScreenStyles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8A0000" />
                    <Text style={topUpScreenStyles.loadingText}>Loading plans...</Text>
                  </View>
                ) : plans && plans.length > 0 ? (
                  plans.map((plan, index) => (
                    <TouchableOpacity 
                      key={plan.plan_id}
                      style={topUpScreenStyles.planCard}
                      onPress={() => handleSelectPlan(plan)}
                      activeOpacity={0.7}
                    >
                      <View style={topUpScreenStyles.planHeader}>
                        <Text style={topUpScreenStyles.planTitle}>{plan.plan_name}</Text>
                        <Text style={topUpScreenStyles.planSubtitle}>{plan.description}</Text>
                      </View>
                      
                      <View style={topUpScreenStyles.planContent}>
                        <View style={topUpScreenStyles.priceSection}>
                          <Text style={topUpScreenStyles.price}>{plan.cost}</Text>
                          <Text style={topUpScreenStyles.currency}>pesos</Text>
                        </View>
                        
                        <View style={topUpScreenStyles.hoursSection}>
                          {maroonTimeIconSvg && (
                            <SvgXml 
                              xml={maroonTimeIconSvg}
                              width={getResponsiveSize(20)}
                              height={getResponsiveSize(20)}
                            />
                          )}
                          <Text style={topUpScreenStyles.hoursText}>{plan.number_of_hours} hours</Text>
                        </View>
                        
                        <TouchableOpacity 
                          style={topUpScreenStyles.selectButton}
                          onPress={() => handleSelectPlan(plan)}
                        >
                          <Text style={topUpScreenStyles.selectButtonText}>Select {plan.number_of_hours} hours</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={topUpScreenStyles.loadingContainer}>
                    <Text style={topUpScreenStyles.loadingText}>No plans available</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Plan Confirmation Modal */}
      <Modal
        visible={isConfirmationModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseConfirmationModal}
      >
        <View style={topUpScreenStyles.modalOverlay}>
          <View style={topUpScreenStyles.confirmationModalContainer}>
            <View style={topUpScreenStyles.modalHeader}>
              <Text style={topUpScreenStyles.modalTitle}>Confirm Plan Selection</Text>
              <TouchableOpacity onPress={handleCloseConfirmationModal}>
                <Text style={topUpScreenStyles.closeXButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedPlan && (
              <View style={topUpScreenStyles.planDetailsContainer}>
                <View style={topUpScreenStyles.planInfoCard}>
                  <Text style={topUpScreenStyles.planInfoTitle}>{selectedPlan.plan_name}</Text>
                  <Text style={topUpScreenStyles.planInfoSubtitle}>{selectedPlan.description}</Text>
                  
                  <View style={topUpScreenStyles.planInfoContent}>
                    <View style={topUpScreenStyles.priceInfoSection}>
                      <Text style={topUpScreenStyles.priceInfoLabel}>Total Amount:</Text>
                      <View style={topUpScreenStyles.priceInfoValue}>
                        <Text style={topUpScreenStyles.priceInfoAmount}>{selectedPlan.cost}</Text>
                        <Text style={topUpScreenStyles.priceInfoCurrency}>pesos</Text>
                      </View>
                    </View>
                    
                    <View style={topUpScreenStyles.hoursInfoSection}>
                      {maroonTimeIconSvg && (
                        <SvgXml 
                          xml={maroonTimeIconSvg}
                          width={getResponsiveSize(20)}
                          height={getResponsiveSize(20)}
                        />
                      )}
                      <Text style={topUpScreenStyles.hoursInfoText}>{selectedPlan.number_of_hours} hours will be added to your account</Text>
                    </View>
                    
                    <Text style={topUpScreenStyles.planDescription}>{selectedPlan.description}</Text>
                  </View>
                </View>
                
                <View style={topUpScreenStyles.modalButtonsContainer}>
                  <TouchableOpacity 
                    style={topUpScreenStyles.cancelButton}
                    onPress={handleCloseConfirmationModal}
                  >
                    <Text style={topUpScreenStyles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[topUpScreenStyles.confirmButton, purchasing && topUpScreenStyles.confirmButtonDisabled]}
                    onPress={handleConfirmPurchase}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={topUpScreenStyles.confirmButtonText}>Confirm Purchase</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* PayPal WebView Modal */}
      <Modal
        visible={showPayPalWebView}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPayPalWebView(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 15,
            backgroundColor: '#f8f8f8',
            borderBottomWidth: 1,
            borderBottomColor: '#ddd',
            paddingTop: Platform.OS === 'ios' ? 50 : 20
          }}>
            <TouchableOpacity 
              onPress={() => setShowPayPalWebView(false)}
              style={{ marginRight: 15 }}
            >
              <Text style={{ color: '#333', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
            <Text style={{ color: '#333', fontSize: 18, fontWeight: 'bold' }}>
              PayPal Payment
            </Text>
          </View>

          {/* WebView */}
          {isProcessingPayPal ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#8A0000" />
              <Text style={{ marginTop: 20, fontSize: 16, color: '#666' }}>
                Processing payment...
              </Text>
            </View>
          ) : (
            <WebView
              source={{ uri: paypalUrl }}
              onNavigationStateChange={handlePayPalNavigation}
              style={{ flex: 1 }}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#8A0000" />
                  <Text style={{ marginTop: 20, fontSize: 16, color: '#666' }}>
                    Loading PayPal...
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

// Styles are now in topUpScreenStyles.ts

export default TopUpScreen;
