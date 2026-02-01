import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Dimensions,
  ScrollView,
  Animated,
  Modal,
  Alert,
  Image
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SharedHeader from '../../components/SharedHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useThemeColors, useTheme } from '../../contexts/ThemeContext';
import { SvgXml } from 'react-native-svg';
import ApiService from '../../services/api';
import { getFavoritesScreenStyles } from '../styles/favoritesScreenStyles';
import { 
  maroonUsersEditIconSvg,
  maroonLocationIconSvg,
  maroonTimeIconSvg,
  maroonTrashIconSvg,
  tapParkLogoSvg,
  whiteCarIconSvg,
  whiteMotorIconSvg,
  whiteEbikeIconSvg
} from '../assets/icons/index2';

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


const FavoritesScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { showLoading, hideLoading } = useLoading();
  const colors = useThemeColors();
  const { isDarkMode } = useTheme();
  const favoritesScreenStyles = getFavoritesScreenStyles(colors);
  const vehicleScrollProgress = useRef(new Animated.Value(0)).current;
  const [isVehicleSelectionModalVisible, setIsVehicleSelectionModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedSpotForBooking, setSelectedSpotForBooking] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [userVehicles, setUserVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [showVehicleMismatchModal, setShowVehicleMismatchModal] = useState(false);
  const [mismatchData, setMismatchData] = useState<any>(null);

  // Profile picture component
  const ProfilePicture = ({ size = 100 }: { size?: number }) => {
    const getInitials = () => {
      if (!user) return '?';
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const profileImageUrl = (user as any)?.profile_image || (user as any)?.profile_image_url;

    // If profile image URL is provided, show the image
    if (profileImageUrl) {
      return (
        <View style={[favoritesScreenStyles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
          <ExpoImage
            source={{ uri: profileImageUrl }}
            style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            onError={({ error }) => {
              console.warn('⚠️ Failed to load profile image (FavoritesScreen):', profileImageUrl, error);
            }}
          />
        </View>
      );
    }

    // Fallback to initials
    return (
      <View style={[favoritesScreenStyles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[favoritesScreenStyles.profileInitials, { fontSize: size * 0.3 }]}>
          {getInitials()}
        </Text>
      </View>
    );
  };

  // Fetch user vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setIsLoadingVehicles(true);
        const response = await ApiService.getVehicles();
        if (response.success) {
          setUserVehicles(response.data.vehicles);
        }
      } catch (error) {
        console.error('Error fetching vehicles:', error);
      } finally {
        setIsLoadingVehicles(false);
      }
    };
    fetchVehicles();
  }, []);

  // Refresh favorites when component mounts or when screen is focused
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setIsLoading(true);
        const response = await ApiService.getFavorites();
        if (response.success) {
          setFavorites(response.data.favorites);
        } else {
          setFavorites([]);
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
        setFavorites([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFavorites();
  }, []);

  // Refresh favorites when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshFavorites = async () => {
        try {
          const response = await ApiService.getFavorites();
          if (response.success) {
            setFavorites(response.data.favorites);
          }
        } catch (error) {
          console.error('Error refreshing favorites:', error);
        }
      };
      
      refreshFavorites();
    }, [])
  );

  // Real-time polling for favorites availability
  useEffect(() => {
    if (favorites.length === 0) {
      return;
    }

    const pollFavorites = async () => {
      try {
        const response = await ApiService.getFavorites();
        if (response.success && response.data?.favorites) {
          setFavorites(response.data.favorites);
          console.log('🔄 Favorites availability updated');
        }
      } catch (error) {
        console.error('Error polling favorites:', error);
      }
    };

    // Poll every 10 seconds
    const pollingInterval = setInterval(pollFavorites, 10000);

    return () => clearInterval(pollingInterval);
  }, [favorites.length > 0]);

  const handleEditProfile = () => {
    // Handle edit profile
  };

  // Get vehicle icon based on type
  const getVehicleIcon = (vehicleType: string) => {
    const type = vehicleType.toLowerCase();
    if (type === 'car') {
        return whiteCarIconSvg;
    } else if (type === 'motorcycle') {
        return whiteMotorIconSvg;
    } else if (type === 'bicycle' || type === 'ebike') {
        return whiteEbikeIconSvg;
    }
    return whiteCarIconSvg; // default
  };

  // Filter vehicles by parking spot compatibility
  const getCompatibleVehicles = () => {
    if (!selectedSpotForBooking) {
      return userVehicles; // Show all vehicles if no specific spot selected
    }

    const spotType = selectedSpotForBooking.spot_type?.toLowerCase();
    if (!spotType) {
      return userVehicles; // Show all if spot type is unknown
    }

    return userVehicles.filter(vehicle => {
      const vehicleType = vehicle.vehicle_type.toLowerCase();
      
      // Map vehicle types to spot types for compatibility
      let expectedSpotType = vehicleType;
      if (vehicleType === 'bicycle' || vehicleType === 'ebike') {
        expectedSpotType = 'bike';
      }
      
      return expectedSpotType === spotType;
    });
  };


  const handleBookSpot = (favorite: any) => {
    console.log('🎯 handleBookSpot called with favorite:', favorite);
    setSelectedSpotForBooking(favorite);
    setIsVehicleSelectionModalVisible(true);
  };

  const handleCloseVehicleSelectionModal = () => {
    setIsVehicleSelectionModalVisible(false);
    setSelectedVehicle('');
    setSelectedSpotForBooking(null);
  };

  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
  };

  const handleVehicleBookNow = async () => {
    console.log('🎯 handleVehicleBookNow called');
    console.log('🎯 selectedVehicle:', selectedVehicle);
    console.log('🎯 selectedSpotForBooking:', selectedSpotForBooking);
    
    if (!selectedVehicle || !selectedSpotForBooking) {
      console.log('❌ Missing vehicle or spot selection');
      return;
    }

    try {
      setIsBooking(true);
      
      // Check spot availability first - don't attempt booking if spot is occupied/reserved
      const spotStatus = selectedSpotForBooking.spot_status || selectedSpotForBooking.status;
      const currentReservation = selectedSpotForBooking.current_reservation;
      
      // Check if spot is occupied by another user
      if (currentReservation && currentReservation.user_id !== user?.user_id) {
        setIsBooking(false);
        Alert.alert(
          'Spot Occupied',
          'This parking spot is currently occupied by another user. Please try a different spot.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Check if spot status is not available
      if (spotStatus && spotStatus !== 'available' && spotStatus !== 'AVAILABLE') {
        // If it's the user's own reservation, allow booking (might be re-booking)
        if (currentReservation && currentReservation.user_id === user?.user_id) {
          // Allow booking to proceed - user might be re-booking their own spot
        } else {
          setIsBooking(false);
          const statusMessage = spotStatus === 'occupied' || spotStatus === 'OCCUPIED' 
            ? 'This parking spot is currently occupied.' 
            : spotStatus === 'reserved' || spotStatus === 'RESERVED'
            ? 'This parking spot is currently reserved.'
            : 'This parking spot is not available for booking.';
          
          Alert.alert(
            'Spot Not Available',
            statusMessage + ' Please try a different spot.',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
      }
      
      // Check for current booking first
      const currentBookingResponse = await ApiService.getMyBookings();
      console.log('🔍 My bookings response:', JSON.stringify(currentBookingResponse, null, 2));
      
      if (currentBookingResponse.success && currentBookingResponse.data.bookings.length > 0) {
        const activeBooking = currentBookingResponse.data.bookings.find(
          (booking: any) => booking.bookingStatus === 'active' || booking.bookingStatus === 'reserved'
        );
        if (activeBooking) {
          setIsBooking(false);
          const statusText = activeBooking.bookingStatus === 'reserved' ? 'reserved' : 'active';
          Alert.alert(
            'Current Booking',
            `You already have a ${statusText} booking at ${activeBooking.parkingArea?.name || 'Unknown Location'} (Spot ${activeBooking.parkingSlot?.spotNumber || 'Unknown'}).\n\nPlease complete or cancel your current booking before making a new one.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
      }

      // Get the selected vehicle
      const vehicle = userVehicles.find(v => v.id.toString() === selectedVehicle);
      if (!vehicle) {
        setIsBooking(false);
        Alert.alert('Error', 'Selected vehicle not found');
        return;
      }

      console.log('🚀 Calling ApiService.bookParkingSpot with:', {
        vehicleId: vehicle.id,
        spotId: selectedSpotForBooking.parking_spot_id,
        areaId: selectedSpotForBooking.parking_area_id
      });

      const response = await ApiService.bookParkingSpot(
        vehicle.id,
        selectedSpotForBooking.parking_spot_id,
        selectedSpotForBooking.parking_area_id
      );
      
      console.log('🎯 Booking response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        Alert.alert(
          'Success',
          'Parking spot booked successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Allow Alert to dismiss first, then navigate smoothly
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    showLoading('Loading parking session...', '/screens/ActiveParkingScreen');
                    router.push({
                      pathname: '/screens/ActiveParkingScreen',
                      params: {
                        sessionId: response.data.reservationId,
                        vehicleId: vehicle.id,
                        vehiclePlate: response.data.bookingDetails.vehiclePlate,
                        vehicleType: response.data.bookingDetails.vehicleType,
                        vehicleBrand: response.data.bookingDetails.vehicleBrand,
                        areaName: response.data.bookingDetails.areaName,
                        areaLocation: response.data.bookingDetails.areaLocation,
                        spotNumber: response.data.bookingDetails.spotNumber,
                        spotType: response.data.bookingDetails.spotType,
                        startTime: response.data.bookingDetails.startTime,
                        status: response.data.bookingDetails.status
                      }
                    });
                    setTimeout(() => hideLoading(), 500);
                    // Reset states
                    setIsVehicleSelectionModalVisible(false);
                    setSelectedVehicle('');
                    setSelectedSpotForBooking(null);
                  }, 150);
                });
              }
            }
          ]
        );
      } else {
        setIsBooking(false);
        // Check if it's a vehicle type mismatch
        if ((response.data as any)?.errorCode === 'VEHICLE_TYPE_MISMATCH') {
          setMismatchData((response.data as any).data);
          setShowVehicleMismatchModal(true);
        } else if ((response.data as any)?.errorCode === 'SPOT_UNAVAILABLE' || 
                   (response.data as any)?.message?.includes('no longer available') ||
                   (response.data as any)?.message?.includes('not available')) {
          Alert.alert(
            'Spot Not Available',
            'This parking spot is no longer available. It may have been booked by another user. Please try a different spot.',
            [{ text: 'OK', style: 'default' }]
          );
        } else {
          Alert.alert('Error', response.data?.message || 'Failed to book parking spot');
        }
      }
    } catch (error: any) {
      setIsBooking(false);
      console.error('Error booking parking spot:', error);
      
      // Check if error is about spot not being available
      if (error?.message?.includes('no longer available') || 
          error?.message?.includes('not available') ||
          error?.message?.includes('SPOT_UNAVAILABLE')) {
        Alert.alert(
          'Spot Not Available',
          'This parking spot is no longer available. It may have been booked by another user. Please try a different spot.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert('Error', 'Failed to book parking spot. Please try again.');
      }
    }
  };

  const handleVehicleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const maxScrollX = contentSize.width - layoutMeasurement.width;
    const scrollPercentage = maxScrollX > 0 ? contentOffset.x / maxScrollX : 0;
    vehicleScrollProgress.setValue(Math.min(scrollPercentage, 1));
  };

  const handleRemoveFavorite = async (parkingSpotId: number) => {
    try {
      const response = await ApiService.removeFavorite(parkingSpotId);
      if (response.success) {
        // Refresh favorites list
        const updatedResponse = await ApiService.getFavorites();
        if (updatedResponse.success) {
          setFavorites(updatedResponse.data.favorites);
        }
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  // Fetch user vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setIsLoadingVehicles(true);
        const response = await ApiService.getVehicles();
        if (response.success) {
          setUserVehicles(response.data.vehicles);
        }
      } catch (error) {
        console.error('Error fetching vehicles:', error);
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    fetchVehicles();
  }, []);

  // Use state for favorite spots to enable re-rendering
  const favoriteSpots = favorites;

  return (
    <View style={favoritesScreenStyles.container}>
      <SharedHeader 
        title="Favorites" 
        showBackButton={false}
      />
      
      <View style={favoritesScreenStyles.scrollContainer}>

        {/* Profile Content Card */}
        <View style={favoritesScreenStyles.profileCard}>
          {/* Profile Picture Section */}
          <View style={favoritesScreenStyles.fixedProfileSection}>
            <View style={favoritesScreenStyles.profilePictureContainer}>
              <ProfilePicture size={isTablet ? 170 : 150} />
            </View>
            
            <View style={favoritesScreenStyles.userInfoContainer}>
              <Text style={favoritesScreenStyles.userName}>FAVORITE SPOTS</Text>
              <Text style={favoritesScreenStyles.userEmail}>YOUR SAVED PARKING LOCATIONS</Text>
            </View>
          </View>

          <ScrollView 
            style={favoritesScreenStyles.profileCardScroll} 
            contentContainerStyle={favoritesScreenStyles.profileCardScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Favorite Spots */}
            <View style={favoritesScreenStyles.spotsContainer}>
              <Text style={favoritesScreenStyles.spotsTitle}>Favorite Spots</Text>
              
              {isLoading ? (
                <View style={favoritesScreenStyles.emptyFavoritesContainer}>
                  <Text style={favoritesScreenStyles.emptyFavoritesTitle}>Loading...</Text>
                </View>
              ) : favorites.length === 0 ? (
                <View style={favoritesScreenStyles.emptyFavoritesContainer}>
                  <Text style={favoritesScreenStyles.emptyFavoritesTitle}>No Favorite Spots</Text>
                  <Text style={favoritesScreenStyles.emptyFavoritesMessage}>
                    You haven't added any parking spots to your favorites yet.
                  </Text>
                  <Text style={favoritesScreenStyles.emptyFavoritesSubMessage}>
                    Book a parking spot and add it to favorites to see it here.
                  </Text>
                </View>
              ) : (
                favorites.map((favorite, index) => (
                <View key={favorite.favorites_id} style={favoritesScreenStyles.parkingCard}>
                  <View style={favoritesScreenStyles.locationHeader}>
                    <View style={favoritesScreenStyles.locationTextContainer}>
                      <Text style={favoritesScreenStyles.parkingLocation}>{favorite.parking_area_name}</Text>
                      <Text style={favoritesScreenStyles.parkingSpotId}>{favorite.spot_number} ({favorite.spot_type})</Text>
                    </View>
                    <Ionicons 
                      name="location" 
                      size={32} 
                      color={favorite.spot_status === 'free' || favorite.spot_status === 'available' || favorite.spot_status === 'AVAILABLE' ? '#4CAF50' : '#FF4444'} 
                    />
                  </View>
                  <Text style={favoritesScreenStyles.parkingLabel}>Location</Text>
                  <View style={favoritesScreenStyles.timeSlotContainer}>
                    <Text style={favoritesScreenStyles.parkingTime}>{favorite.location}</Text>
                  </View>
                  <View style={favoritesScreenStyles.parkingStatusContainer}>
                    <Text style={[
                      (favorite.spot_status === 'free' || favorite.spot_status === 'available' || favorite.spot_status === 'AVAILABLE') ? favoritesScreenStyles.availableStatus : favoritesScreenStyles.occupiedStatus
                    ]}>
                      {favorite.spot_status.toUpperCase()}
                    </Text>
                    <View style={favoritesScreenStyles.parkingActionsContainer}>
                      <TouchableOpacity 
                        style={favoritesScreenStyles.bookButton}
                        onPress={() => handleBookSpot(favorite)}
                      >
                        <Text style={favoritesScreenStyles.bookButtonText}>BOOK</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={favoritesScreenStyles.removeButton}
                        onPress={() => handleRemoveFavorite(favorite.parking_spot_id)}
                      >
                        <SvgXml 
                          xml={maroonTrashIconSvg}
                          width={20}
                          height={20}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Vehicle Selection Modal */}
      <Modal
        visible={isVehicleSelectionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseVehicleSelectionModal}
      >
        <View style={favoritesScreenStyles.modalOverlay}>
          <View style={favoritesScreenStyles.vehicleSelectionModalContainer}>
            <View style={favoritesScreenStyles.vehicleModalHeader}>
              <Text style={favoritesScreenStyles.vehicleModalTitle}>Select Vehicle for Reservation</Text>
              <TouchableOpacity onPress={handleCloseVehicleSelectionModal}>
                <Ionicons name="close" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={favoritesScreenStyles.vehicleTypeInfoContainer}>
              <Text style={favoritesScreenStyles.vehicleTypeInfoText}>
                {selectedSpotForBooking 
                  ? `💡 Only vehicles compatible with ${selectedSpotForBooking.spot_type} spots are shown`
                  : '💡 Select a vehicle to book a parking spot'
                }
              </Text>
            </View>
            
            {getCompatibleVehicles().length === 0 ? (
              <View style={favoritesScreenStyles.noCompatibleVehiclesContainer}>
                <Text style={favoritesScreenStyles.noCompatibleVehiclesText}>
                  No vehicles compatible with this parking spot type
                </Text>
                <Text style={favoritesScreenStyles.noCompatibleVehiclesSubtext}>
                  Add a {selectedSpotForBooking?.spot_type || 'compatible'} vehicle to your account
                </Text>
              </View>
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={favoritesScreenStyles.vehicleSelectionScroll}
                contentContainerStyle={favoritesScreenStyles.vehicleSelectionScrollContent}
                onScroll={handleVehicleScroll}
                scrollEventThrottle={16}
              >
                {getCompatibleVehicles().map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      favoritesScreenStyles.vehicleSelectionCard,
                      selectedVehicle === vehicle.id.toString() && favoritesScreenStyles.vehicleSelectionCardSelected
                    ]}
                    onPress={() => handleSelectVehicle(vehicle.id.toString())}
                  >
                    <View style={favoritesScreenStyles.vehicleSelectionIconContainer}>
                      <SvgXml xml={getVehicleIcon(vehicle.vehicle_type)} width={getResponsiveSize(40)} height={getResponsiveSize(40)} />
                    </View>
                    <Text style={favoritesScreenStyles.vehicleSelectionLabel}>Brand and Model</Text>
                    <Text style={favoritesScreenStyles.vehicleSelectionValue}>{vehicle.brand || 'N/A'}</Text>
                    <Text style={favoritesScreenStyles.vehicleSelectionLabel}>Vehicle Type</Text>
                    <Text style={favoritesScreenStyles.vehicleSelectionValue}>{vehicle.vehicle_type}</Text>
                    {vehicle.plate_number && (
                      <>
                        <Text style={favoritesScreenStyles.vehicleSelectionLabel}>Plate Number</Text>
                        <Text style={favoritesScreenStyles.vehicleSelectionValue}>{vehicle.plate_number}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            {/* Progress Indicator */}
            <View style={favoritesScreenStyles.vehicleSelectionProgressContainer}>
              <View style={favoritesScreenStyles.vehicleSelectionProgressTrack}>
                <Animated.View 
                  style={[
                    favoritesScreenStyles.vehicleSelectionProgressHandle,
                    {
                      left: vehicleScrollProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.max(0, (screenWidth * 0.9 - 48) - getResponsiveSize(20))],
                        extrapolate: 'clamp',
                      }),
                    }
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[
                favoritesScreenStyles.vehicleSelectionBookNowButton,
                (!selectedVehicle || isBooking || getCompatibleVehicles().length === 0) && favoritesScreenStyles.vehicleSelectionBookNowButtonDisabled
              ]}
              onPress={handleVehicleBookNow}
              disabled={!selectedVehicle || isBooking || getCompatibleVehicles().length === 0}
            >
              <Text style={favoritesScreenStyles.vehicleSelectionBookNowButtonText}>
                {isBooking ? 'Booking...' : 
                 getCompatibleVehicles().length === 0 ? 'No Compatible Vehicles' : 'Book Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Vehicle Type Mismatch Modal */}
      <Modal
        visible={showVehicleMismatchModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVehicleMismatchModal(false)}
      >
        <View style={favoritesScreenStyles.modalOverlay}>
          <View style={favoritesScreenStyles.mismatchModalContainer}>
            <View style={favoritesScreenStyles.mismatchModalHeader}>
              <Text style={favoritesScreenStyles.mismatchModalTitle}>🚗 Vehicle Type Mismatch</Text>
              <TouchableOpacity onPress={() => setShowVehicleMismatchModal(false)}>
                <Ionicons name="close" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={favoritesScreenStyles.mismatchContent}>
              <Text style={favoritesScreenStyles.mismatchMessage}>
                Oops! There's a mismatch between your vehicle and this parking spot.
              </Text>
              
              <View style={favoritesScreenStyles.mismatchDetails}>
                <View style={favoritesScreenStyles.mismatchItem}>
                  <Text style={favoritesScreenStyles.mismatchLabel}>Your Vehicle:</Text>
                  <Text style={favoritesScreenStyles.mismatchValue}>{mismatchData?.vehicleType || 'Unknown'}</Text>
                </View>
                
                <View style={favoritesScreenStyles.mismatchItem}>
                  <Text style={favoritesScreenStyles.mismatchLabel}>Spot Type:</Text>
                  <Text style={favoritesScreenStyles.mismatchValue}>{mismatchData?.spotType || 'Unknown'}</Text>
                </View>
              </View>
              
              <Text style={favoritesScreenStyles.mismatchSuggestion}>
                💡 Try selecting a different vehicle or choose a different parking spot that matches your vehicle type.
              </Text>
            </View>
            
            <TouchableOpacity 
              style={favoritesScreenStyles.mismatchCloseButton}
              onPress={() => setShowVehicleMismatchModal(false)}
            >
              <Text style={favoritesScreenStyles.mismatchCloseButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Styles are now in favoritesScreenStyles.ts

export default FavoritesScreen;
