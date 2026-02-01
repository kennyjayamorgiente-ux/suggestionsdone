import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  ScrollView,
  Animated,
  Modal,
  Alert,
  ActivityIndicator,
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
import { 
  maroonUsersEditIconSvg,
  maroonLocationIconSvg,
  maroonTimeIconSvg,
  tapParkLogoSvg,
  maroonFavIconSvg,
  maroonTrashIconSvg,
  whiteCarIconSvg,
  whiteMotorIconSvg,
  whiteEbikeIconSvg
} from '../assets/icons/index2';
import { ApiService } from '../../services/api';
import { 
  useScreenDimensions, 
  getAdaptiveFontSize, 
  getAdaptiveSize, 
  getAdaptivePadding, 
  getAdaptiveMargin 
} from '../../hooks/use-screen-dimensions';
import { createHistoryScreenStyles } from '../styles/historyScreenStyles';

// Now using dynamic orientation-aware responsive system

// Helper function to format decimal hours to HH.MM format (e.g., 83.5 -> "83.30")
const formatHoursToHHMM = (decimalHours: number | string | null | undefined): string => {
  const hours = typeof decimalHours === 'string' ? parseFloat(decimalHours) : (decimalHours || 0);
  // Ensure minimum of 1 minute (0.0167 hours) is displayed as 0.01
  if (hours === 0) return '0.01';
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  // If less than 1 minute, ensure it shows as 0.01 (1 minute minimum)
  if (wholeHours === 0 && minutes === 0) return '0.01';
  return `${wholeHours}.${minutes.toString().padStart(2, '0')}`;
};

const HistoryScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { showLoading, hideLoading } = useLoading();
  const colors = useThemeColors();
  const { isDarkMode } = useTheme();
  const screenDimensions = useScreenDimensions();
  const vehicleScrollProgress = useRef(new Animated.Value(0)).current;
  const [isVehicleSelectionModalVisible, setIsVehicleSelectionModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [isReservationModalVisible, setIsReservationModalVisible] = useState(false);
  const [selectedSpotForBooking, setSelectedSpotForBooking] = useState<any>(null);
  const [showVehicleMismatchModal, setShowVehicleMismatchModal] = useState(false);
  const [mismatchData, setMismatchData] = useState<any>(null);
  const [isBooking, setIsBooking] = useState(false);

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
        <View style={[styles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
          <ExpoImage
            source={{ uri: profileImageUrl }}
            style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            onError={({ error }) => {
              console.warn('⚠️ Failed to load profile image (HistoryScreen):', profileImageUrl, error);
            }}
          />
        </View>
      );
    }

    // Fallback to initials
    return (
      <View style={[styles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.profileInitials, { fontSize: size * 0.3 }]}>
          {getInitials()}
        </Text>
      </View>
    );
  };

  // Load parking history from API
  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const response = await ApiService.getParkingHistory(1, 20);
      if (response.success) {
        setHistoryData(response.data.sessions);
        setPagination(response.data.pagination);
      } else {
        Alert.alert('Error', 'Failed to load parking history');
      }
    } catch (error) {
      console.error('Error loading history:', error);
      Alert.alert('Error', 'Failed to load parking history');
    } finally {
      setIsLoading(false);
    }
  };

  // Load history when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 History screen focused - loading history data');
      loadHistory();
    }, [])
  );

  const handleEditProfile = () => {
    // Handle edit profile
  };

  const handleViewDetails = (historyId: string) => {
    // Handle view details
    console.log('View details for:', historyId);
  };

  const handleBookAgain = (historyId: string) => {
    console.log('🎯 handleBookAgain called with historyId:', historyId);
    
    // Find the history item to get spot details
    const historyItem = historyData.find(item => item.reservation_id === historyId);
    if (historyItem) {
      console.log('🎯 Found history item:', historyItem);
      
      // Validate that required fields exist
      if (!historyItem.parking_spot_id || !historyItem.parking_area_id) {
        console.error('❌ Missing required fields:', {
          parking_spot_id: historyItem.parking_spot_id,
          parking_area_id: historyItem.parking_area_id,
          historyItem
        });
        Alert.alert(
          'Error',
          'Missing parking spot information. Please try refreshing the history or contact support.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      setSelectedSpotForBooking(historyItem);
      setIsVehicleSelectionModalVisible(true);
    } else {
      console.log('❌ History item not found');
      Alert.alert('Error', 'Could not find booking details');
    }
  };

  const handleAddToFavorites = async (historyId: string) => {
    try {
      // Find the history item to get reservation ID
      const historyItem = historyData.find(item => item.reservation_id === historyId);
      if (!historyItem) {
        Alert.alert('Error', 'Could not find booking details');
        return;
      }
      
      // Get parking spot ID from reservation (history data doesn't include parking_spots_id)
      let parkingSpotId: number | null = null;
      
      try {
        const spotIdResponse = await ApiService.getParkingSpotIdFromReservation(Number(historyId));
        if (spotIdResponse.success && spotIdResponse.data.parkingSpotId) {
          parkingSpotId = spotIdResponse.data.parkingSpotId;
          console.log('Got parking spot ID from reservation:', parkingSpotId);
        } else {
          throw new Error('Failed to get parking spot ID from reservation');
        }
      } catch (spotIdError) {
        console.error('Error getting parking spot ID from reservation:', spotIdError);
        Alert.alert(
          'Error',
          'Unable to retrieve parking spot information. Please try again later.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Validate parking spot ID
      if (!parkingSpotId || isNaN(Number(parkingSpotId))) {
        Alert.alert(
          'Error',
          'Invalid parking spot information. Please contact support.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const response = await ApiService.addFavorite(Number(parkingSpotId));
      if (response.success) {
        if ((response as any).alreadyExists) {
          Alert.alert('Already in Favorites!', 'This parking spot is already in your favorites.');
        } else {
          Alert.alert('Success!', 'Parking spot added to favorites.');
        }
      } else {
        Alert.alert('Error', response.message || 'Failed to add to favorites');
      }
    } catch (error) {
      console.error('Error adding to favorites:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Parking spot not found')) {
          Alert.alert(
            'Error',
            'This parking spot is no longer available. It may have been removed from the system.',
            [{ text: 'OK' }]
          );
        } else if (error.message.includes('already in favorites')) {
          Alert.alert('Already in Favorites!', 'This parking spot is already in your favorites.');
        } else {
          Alert.alert('Error', error.message || 'Failed to add to favorites. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Failed to add to favorites. Please try again.');
      }
    }
  };

  const handleDeleteHistory = async (historyId: string) => {
    Alert.alert(
      'Delete History Record',
      'Are you sure you want to delete this history record? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              showLoading('Deleting history record...');
              const response = await ApiService.deleteHistoryRecord(Number(historyId));
              hideLoading();
              
              if (response.success) {
                // Remove the item from local state
                setHistoryData(prevData => prevData.filter(item => item.reservation_id !== historyId));
                Alert.alert('Success', 'History record deleted successfully.');
              } else {
                Alert.alert('Error', response.message || 'Failed to delete history record');
              }
            } catch (error) {
              hideLoading();
              console.error('Error deleting history:', error);
              Alert.alert('Error', 'Failed to delete history record. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleCloseVehicleSelectionModal = () => {
    setIsVehicleSelectionModalVisible(false);
    setSelectedVehicle('');
    setSelectedSpotForBooking(null);
  };

  const handleReservationPress = (reservation: any) => {
    setSelectedReservation(reservation);
    setIsReservationModalVisible(true);
  };

  const handleCloseReservationModal = () => {
    setIsReservationModalVisible(false);
    setSelectedReservation(null);
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
      
      // Check if spot status is not available
      if (spotStatus && spotStatus !== 'available' && spotStatus !== 'AVAILABLE') {
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
      
      // Check if it's a specific error message from the API
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('no longer available') || 
          errorMessage.includes('not available') ||
          errorMessage.includes('SPOT_UNAVAILABLE')) {
        Alert.alert(
          'Spot Not Available', 
          'This parking spot is no longer available. It may have been booked by another user. Please try a different spot.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Refresh history to show updated availability
                loadHistory();
              }
            }
          ]
        );
      } else if (errorMessage.includes('VEHICLE_TYPE_MISMATCH')) {
        // This should be handled by the existing vehicle mismatch logic
        console.log('Vehicle type mismatch handled by existing logic');
      } else {
        Alert.alert(
          'Booking Failed', 
          'Unable to book the parking spot. Please try again.',
          [
            {
              text: 'Retry',
              onPress: () => handleVehicleBookNow()
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      }
    } finally {
      setIsBooking(false);
    }
  };

  const handleVehicleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const maxScrollX = contentSize.width - layoutMeasurement.width;
    const scrollPercentage = maxScrollX > 0 ? contentOffset.x / maxScrollX : 0;
    vehicleScrollProgress.setValue(Math.min(scrollPercentage, 1));
  };

  // Get user vehicles from API
  const [userVehicles, setUserVehicles] = useState<any[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

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

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Format duration for display
  const formatDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format time for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
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

  // Get landmark icon color based on booking status
  const getLandmarkIconColor = (status?: string) => {
    if (!status) return '#9CA3AF'; // Gray default
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed') return '#4CAF50'; // Green
    if (statusLower === 'cancelled') return '#FF4444'; // Red
    if (statusLower === 'active') return '#2196F3'; // Blue
    if (statusLower === 'reserved') return '#FFA500'; // Orange
    return '#9CA3AF'; // Gray default
  };

  const styles = createHistoryScreenStyles(screenDimensions, colors);

  return (
    <View style={styles.container}>
      <SharedHeader 
        title="History" 
        showBackButton={false}
      />
      
      <View style={styles.scrollContainer}>

        {/* Profile Content Card */}
        <View style={styles.profileCard}>
          {/* Profile Picture Section */}
          <View style={styles.fixedProfileSection}>
            <View style={styles.profilePictureContainer}>
              <ProfilePicture size={screenDimensions.isTablet ? 170 : 150} />
            </View>
            
            <View style={styles.userInfoContainer}>
              <Text style={styles.userName}>PARKING HISTORY</Text>
              <Text style={styles.userEmail}>YOUR PAST PARKING SESSIONS</Text>
            </View>
          </View>

          <ScrollView style={styles.profileCardScroll} showsVerticalScrollIndicator={false}>
            {/* History Spots */}
            <View style={styles.spotsContainer}>
              <Text style={styles.spotsTitle}>Parking History</Text>
              
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading parking history...</Text>
                </View>
              ) : historyData.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No parking history found</Text>
                  <Text style={styles.emptySubtext}>Your parking sessions will appear here</Text>
                </View>
              ) : (
                historyData.map((spot, index) => (
                  <TouchableOpacity 
                    key={spot.reservation_id} 
                    style={styles.parkingCard}
                    onPress={() => handleReservationPress(spot)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.locationHeader}>
                      <View style={styles.locationTextContainer}>
                        <Text style={styles.parkingLocation}>{spot.location_name}</Text>
                        <Text style={styles.parkingSpotId}>RES-{spot.reservation_id}</Text>
                      </View>
                      <Ionicons 
                        name="location" 
                        size={32} 
                        color={getLandmarkIconColor(spot.booking_status)} 
                      />
                    </View>
                    <Text style={styles.parkingLabel}>Scan Timestamps</Text>
                    <View style={styles.timeSlotContainer}>
                      <View style={styles.timestampRow}>
                        <Text style={styles.timestampLabel}>Start Scan:</Text>
                        <Text style={styles.timestampValue}>
                          {spot.start_time ? formatDate(spot.start_time) : 'Not scanned'}
                        </Text>
                      </View>
                      <View style={styles.timestampRow}>
                        <Text style={styles.timestampLabel}>End Scan:</Text>
                        <Text style={styles.timestampValue}>
                          {spot.end_time ? formatDate(spot.end_time) : 'Not scanned'}
                        </Text>
                      </View>
                      <Text style={styles.durationText}>
                        Duration: {formatDuration(spot.start_time, spot.end_time)}
                      </Text>
                      {spot.hours_deducted !== null && spot.hours_deducted !== undefined ? (
                        <Text style={styles.hoursDeductedText}>
                          Hours Deducted: {formatHoursToHHMM(spot.hours_deducted)} hr{parseFloat(String(spot.hours_deducted)) >= 1 ? 's' : ''}
                        </Text>
                      ) : spot.end_time ? (
                        <Text style={styles.hoursDeductedText}>
                          Hours Deducted: 0.01 hr
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.parkingLabel}>Vehicle</Text>
                    <Text style={styles.parkingTime}>
                      {spot.vehicle_type} - {spot.brand} ({spot.plate_number})
                    </Text>
                    <Text style={styles.parkingLabel}>Spot</Text>
                    <Text style={styles.parkingTime}>
                      {spot.spot_number} ({spot.spot_type})
                    </Text>
                    <Text style={styles.historyDate}>Date: {formatDate(spot.time_stamp)}</Text>
                    <View style={styles.parkingStatusContainer}>
                      <Text style={[
                        styles.completedStatus,
                        spot.booking_status === 'completed' ? styles.completedStatus : 
                        spot.booking_status === 'active' ? styles.activeStatus : styles.reservedStatus
                      ]}>
                        {spot.booking_status.toUpperCase()}
                      </Text>
                      <View style={styles.buttonContainer}>
                        <TouchableOpacity 
                          style={styles.trashButton}
                          onPress={() => handleDeleteHistory(spot.reservation_id)}
                        >
                          <SvgXml xml={maroonTrashIconSvg} width={getAdaptiveSize(screenDimensions, 20)} height={getAdaptiveSize(screenDimensions, 20)} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.heartButton}
                          onPress={() => handleAddToFavorites(spot.reservation_id)}
                        >
                          <SvgXml xml={maroonFavIconSvg} width={getAdaptiveSize(screenDimensions, 20)} height={getAdaptiveSize(screenDimensions, 20)} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.bookButton}
                          onPress={() => handleBookAgain(spot.reservation_id)}
                        >
                          <Text style={styles.bookButtonText}>BOOK AGAIN</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
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
        <View style={styles.modalOverlay}>
          <View style={styles.vehicleSelectionModalContainer}>
            <View style={styles.vehicleModalHeader}>
              <Text style={styles.vehicleModalTitle}>Select Vehicle for Reservation</Text>
              <TouchableOpacity onPress={handleCloseVehicleSelectionModal}>
                <Ionicons name="close" size={24} color="#8A0000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.vehicleTypeInfoContainer}>
              <Text style={styles.vehicleTypeInfoText}>
                {selectedSpotForBooking 
                  ? `💡 Only vehicles compatible with ${selectedSpotForBooking.spot_type} spots are shown`
                  : '💡 Select a vehicle to book a parking spot'
                }
              </Text>
            </View>
            
            {getCompatibleVehicles().length === 0 ? (
              <View style={styles.noCompatibleVehiclesContainer}>
                <Text style={styles.noCompatibleVehiclesText}>
                  No vehicles compatible with this parking spot type
                </Text>
                <Text style={styles.noCompatibleVehiclesSubtext}>
                  Add a {selectedSpotForBooking?.spot_type || 'compatible'} vehicle to your account
                </Text>
              </View>
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.vehicleSelectionScroll}
                contentContainerStyle={styles.vehicleSelectionScrollContent}
                onScroll={handleVehicleScroll}
                scrollEventThrottle={16}
              >
                {getCompatibleVehicles().map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      styles.vehicleSelectionCard,
                      selectedVehicle === vehicle.id.toString() && styles.vehicleSelectionCardSelected
                    ]}
                    onPress={() => handleSelectVehicle(vehicle.id.toString())}
                  >
                    <View style={styles.vehicleSelectionIconContainer}>
                      <SvgXml xml={getVehicleIcon(vehicle.vehicle_type)} width={getAdaptiveSize(screenDimensions, 40)} height={getAdaptiveSize(screenDimensions, 40)} />
                    </View>
                    <Text style={styles.vehicleSelectionLabel}>Brand and Model</Text>
                    <Text style={styles.vehicleSelectionValue}>{vehicle.brand || 'N/A'}</Text>
                    <Text style={styles.vehicleSelectionLabel}>Vehicle Type</Text>
                    <Text style={styles.vehicleSelectionValue}>{vehicle.vehicle_type}</Text>
                    {vehicle.plate_number && (
                      <>
                        <Text style={styles.vehicleSelectionLabel}>Plate Number</Text>
                        <Text style={styles.vehicleSelectionValue}>{vehicle.plate_number}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            {/* Progress Indicator */}
            <View style={styles.vehicleSelectionProgressContainer}>
              <View style={styles.vehicleSelectionProgressTrack}>
                <Animated.View 
                  style={[
                    styles.vehicleSelectionProgressHandle,
                    {
                      left: vehicleScrollProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.max(0, (screenDimensions.width * 0.9 - 48) - getAdaptiveSize(screenDimensions, 20))],
                        extrapolate: 'clamp',
                      }),
                    }
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[
                styles.vehicleSelectionBookNowButton,
                (!selectedVehicle || isBooking || getCompatibleVehicles().length === 0) && styles.vehicleSelectionBookNowButtonDisabled
              ]}
              onPress={handleVehicleBookNow}
              disabled={!selectedVehicle || isBooking || getCompatibleVehicles().length === 0}
            >
              <Text style={styles.vehicleSelectionBookNowButtonText}>
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
        <View style={styles.modalOverlay}>
          <View style={styles.mismatchModalContainer}>
            <View style={styles.mismatchModalHeader}>
              <Text style={styles.mismatchModalTitle}>🚗 Vehicle Type Mismatch</Text>
              <TouchableOpacity onPress={() => setShowVehicleMismatchModal(false)}>
                <Ionicons name="close" size={24} color="#8A0000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.mismatchContent}>
              <Text style={styles.mismatchMessage}>
                Oops! There's a mismatch between your vehicle and this parking spot.
              </Text>
              
              <View style={styles.mismatchDetails}>
                <View style={styles.mismatchItem}>
                  <Text style={styles.mismatchLabel}>Your Vehicle:</Text>
                  <Text style={styles.mismatchValue}>{mismatchData?.vehicleType || 'Unknown'}</Text>
                </View>
                
                <View style={styles.mismatchItem}>
                  <Text style={styles.mismatchLabel}>Spot Type:</Text>
                  <Text style={styles.mismatchValue}>{mismatchData?.spotType || 'Unknown'}</Text>
                </View>
              </View>
              
              <Text style={styles.mismatchSuggestion}>
                💡 Try selecting a different vehicle or choose a different parking spot that matches your vehicle type.
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.mismatchCloseButton}
              onPress={() => setShowVehicleMismatchModal(false)}
            >
              <Text style={styles.mismatchCloseButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reservation Details Modal */}
      <Modal
        visible={isReservationModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseReservationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reservationModalContainer}>
            <View style={styles.reservationModalHeader}>
              <Text style={styles.reservationModalTitle}>Reservation Details</Text>
              <TouchableOpacity onPress={handleCloseReservationModal}>
                <Ionicons name="close" size={24} color="#8A0000" />
              </TouchableOpacity>
            </View>
            
            {selectedReservation && (
              <ScrollView style={styles.reservationModalContent}>
                <View style={styles.reservationDetailCard}>
                  <View style={styles.reservationDetailHeader}>
                    <Text style={styles.reservationLocation}>{selectedReservation.location_name}</Text>
                    <Text style={styles.reservationId}>RES-{selectedReservation.reservation_id}</Text>
                  </View>
                  
                  <View style={styles.reservationDetailSection}>
                    <Text style={styles.reservationDetailLabel}>Scan Timestamps</Text>
                    <View style={styles.timestampDetailRow}>
                      <Text style={styles.timestampDetailLabel}>Start Scan:</Text>
                      <Text style={styles.timestampDetailValue}>
                        {selectedReservation.start_time ? formatDate(selectedReservation.start_time) : 'Not scanned'}
                      </Text>
                    </View>
                    <View style={styles.timestampDetailRow}>
                      <Text style={styles.timestampDetailLabel}>End Scan:</Text>
                      <Text style={styles.timestampDetailValue}>
                        {selectedReservation.end_time ? formatDate(selectedReservation.end_time) : 'Not scanned'}
                      </Text>
                    </View>
                    <Text style={styles.reservationDetailSubValue}>
                      Duration: {formatDuration(selectedReservation.start_time, selectedReservation.end_time)}
                    </Text>
                    {selectedReservation.hours_deducted !== null && selectedReservation.hours_deducted !== undefined ? (
                      <Text style={styles.reservationDetailSubValue}>
                        Hours Deducted: {formatHoursToHHMM(selectedReservation.hours_deducted)} hr{parseFloat(String(selectedReservation.hours_deducted)) >= 1 ? 's' : ''}
                      </Text>
                    ) : selectedReservation.end_time ? (
                      <Text style={styles.reservationDetailSubValue}>
                        Hours Deducted: 0.01 hr
                      </Text>
                    ) : (
                      <Text style={styles.reservationDetailSubValue}>
                        Hours Deducted: N/A
                      </Text>
                    )}
                  </View>

                  <View style={styles.reservationDetailSection}>
                    <Text style={styles.reservationDetailLabel}>Vehicle</Text>
                    <Text style={styles.reservationDetailValue}>
                      {selectedReservation.vehicle_type} - {selectedReservation.brand}
                    </Text>
                    <Text style={styles.reservationDetailSubValue}>
                      Plate Number: {selectedReservation.plate_number}
                    </Text>
                  </View>

                  <View style={styles.reservationDetailSection}>
                    <Text style={styles.reservationDetailLabel}>Parking Spot</Text>
                    <Text style={styles.reservationDetailValue}>
                      Spot {selectedReservation.spot_number}
                    </Text>
                    <Text style={styles.reservationDetailSubValue}>
                      Type: {selectedReservation.spot_type}
                    </Text>
                  </View>

                  <View style={styles.reservationDetailSection}>
                    <Text style={styles.reservationDetailLabel}>Date</Text>
                    <Text style={styles.reservationDetailValue}>
                      {formatDate(selectedReservation.time_stamp)}
                    </Text>
                  </View>

                  <View style={styles.reservationDetailSection}>
                    <Text style={styles.reservationDetailLabel}>Status</Text>
                    <Text style={[
                      styles.reservationDetailValue,
                      selectedReservation.booking_status === 'completed' ? styles.completedStatus : 
                      selectedReservation.booking_status === 'active' ? styles.activeStatus : styles.reservedStatus
                    ]}>
                      {selectedReservation.booking_status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (screenDimensions: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#383838',
  },
  scrollContainer: {
    flex: 1,
  },
  backgroundSection: {
    height: screenDimensions.height * 0.3,
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  profileCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: getAdaptiveSize(screenDimensions, 25),
    borderTopRightRadius: getAdaptiveSize(screenDimensions, 25),
    paddingTop: getAdaptivePadding(screenDimensions, 25),
    paddingBottom: getAdaptivePadding(screenDimensions, 35),
    paddingHorizontal: getAdaptivePadding(screenDimensions, 20),
    maxHeight: screenDimensions.height * 0.75,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.1,
    shadowRadius: getAdaptiveSize(screenDimensions, 10),
    elevation: 10,
  },
  profileCardScroll: {
    flex: 1,
  },
  fixedProfileSection: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 30),
  },
  profilePictureContainer: {
    position: 'relative',
    marginTop: -getAdaptiveSize(screenDimensions, 70),
    backgroundColor: 'transparent',
    borderRadius: getAdaptiveSize(screenDimensions, 90),
    width: getAdaptiveSize(screenDimensions, 180),
    height: getAdaptiveSize(screenDimensions, 180),
    borderWidth: getAdaptiveSize(screenDimensions, 3),
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicture: {
    backgroundColor: '#8A0000',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  userInfoContainer: {
    alignItems: 'center',
    marginTop: getAdaptiveSize(screenDimensions, 15),
  },
  userName: {
    fontSize: getAdaptiveFontSize(screenDimensions, 24),
    fontWeight: 'bold',
    color: '#8A0000',
    marginBottom: getAdaptiveMargin(screenDimensions, 5),
    letterSpacing: 1,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#666',
    textAlign: 'center',
  },
  spotsContainer: {
    flex: 1,
  },
  spotsTitle: {
    fontSize: getAdaptiveFontSize(screenDimensions, 20),
    fontWeight: 'bold',
    color: '#8A0000',
    marginBottom: getAdaptiveMargin(screenDimensions, 20),
  },
  parkingCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#8A0000',
    borderRadius: 12,
    padding: getAdaptivePadding(screenDimensions, 16),
    marginBottom: getAdaptiveMargin(screenDimensions, 15),
    position: 'relative',
    shadowColor: '#8A0000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: getAdaptiveSize(screenDimensions, 4),
    elevation: 3,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  locationTextContainer: {
    flex: 1,
  },
  parkingLocation: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#6B7280',
    marginBottom: getAdaptiveMargin(screenDimensions, 4),
  },
  parkingSpotId: {
    fontSize: getAdaptiveFontSize(screenDimensions, 18),
    fontWeight: 'bold',
    color: '#8A0000',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  logoIcon: {
    width: getAdaptiveSize(screenDimensions, 60),
    height: getAdaptiveSize(screenDimensions, 60),
    resizeMode: 'contain',
  },
  parkingLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#6B7280',
    marginBottom: getAdaptiveMargin(screenDimensions, 4),
  },
  timeSlotContainer: {
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  parkingTime: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#1F2937',
    flex: 1,
  },
  hoursDeductedText: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#8A0000',
    fontWeight: '600',
    marginTop: getAdaptiveMargin(screenDimensions, 4),
  },
  durationText: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#666666',
    fontWeight: '500',
    marginTop: getAdaptiveMargin(screenDimensions, 2),
  },
  parkingPrice: {
    fontSize: getAdaptiveFontSize(screenDimensions, 16),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  historyDate: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#6B7280',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  parkingStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completedStatus: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: getAdaptiveMargin(screenDimensions, 8),
  },
  heartButton: {
    backgroundColor: '#F5F5F5',
    padding: getAdaptivePadding(screenDimensions, 8),
    borderRadius: getAdaptiveSize(screenDimensions, 6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButton: {
    backgroundColor: '#8A0000',
    paddingHorizontal: getAdaptivePadding(screenDimensions, 16),
    paddingVertical: getAdaptivePadding(screenDimensions, 8),
    borderRadius: 6,
  },
  bookButtonText: {
    color: 'white',
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    fontWeight: 'bold',
  },
  // Vehicle Selection Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleSelectionModalContainer: {
    backgroundColor: 'white',
    borderRadius: getAdaptiveSize(screenDimensions, 16),
    padding: getAdaptivePadding(screenDimensions, 24),
    margin: getAdaptiveMargin(screenDimensions, 20),
    maxHeight: '80%',
    width: '90%',
    alignSelf: 'center',
  },
  vehicleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 20),
  },
  vehicleModalTitle: {
    fontSize: getAdaptiveFontSize(screenDimensions, 20),
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  // Reservation Details Modal Styles
  reservationModalContainer: {
    backgroundColor: 'white',
    borderRadius: getAdaptiveSize(screenDimensions, 16),
    padding: getAdaptivePadding(screenDimensions, 24),
    margin: getAdaptiveMargin(screenDimensions, 20),
    maxHeight: '85%',
    minHeight: 400,
    width: '90%',
    alignSelf: 'center',
  },
  reservationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 20),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: getAdaptivePadding(screenDimensions, 16),
  },
  reservationModalTitle: {
    fontSize: getAdaptiveFontSize(screenDimensions, 20),
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  reservationModalContent: {
    flex: 1,
    minHeight: 200,
  },
  reservationDetailCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: getAdaptiveSize(screenDimensions, 12),
    padding: getAdaptivePadding(screenDimensions, 20),
  },
  reservationDetailHeader: {
    marginBottom: getAdaptiveMargin(screenDimensions, 20),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: getAdaptivePadding(screenDimensions, 16),
  },
  reservationLocation: {
    fontSize: getAdaptiveFontSize(screenDimensions, 18),
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: getAdaptiveMargin(screenDimensions, 4),
  },
  reservationId: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#8A0000',
    fontWeight: '600',
  },
  reservationDetailSection: {
    marginBottom: getAdaptiveMargin(screenDimensions, 16),
  },
  reservationDetailLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    fontWeight: '600',
    color: '#374151',
    marginBottom: getAdaptiveMargin(screenDimensions, 4),
  },
  reservationDetailValue: {
    fontSize: getAdaptiveFontSize(screenDimensions, 16),
    color: '#1F2937',
    marginBottom: getAdaptiveMargin(screenDimensions, 2),
  },
  reservationDetailSubValue: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#6B7280',
    marginBottom: getAdaptiveMargin(screenDimensions, 2),
  },
  vehicleCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: getAdaptiveMargin(screenDimensions, 20),
  },
  vehicleCard: {
    backgroundColor: 'white',
    borderRadius: getAdaptiveSize(screenDimensions, 12),
    padding: getAdaptivePadding(screenDimensions, 16),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: getAdaptiveMargin(screenDimensions, 4),
    minHeight: getAdaptiveSize(screenDimensions, 200),
  },
  selectedVehicleCard: {
    borderWidth: 3,
    borderColor: '#8A0000',
  },
  vehicleIconContainer: {
    backgroundColor: '#8A0000',
    borderRadius: getAdaptiveSize(screenDimensions, 8),
    padding: getAdaptivePadding(screenDimensions, 12),
    marginBottom: getAdaptiveMargin(screenDimensions, 12),
    width: getAdaptiveSize(screenDimensions, 48),
    height: getAdaptiveSize(screenDimensions, 48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleBrandLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#999999',
    marginBottom: getAdaptiveMargin(screenDimensions, 4),
  },
  vehicleBrand: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
    textAlign: 'center',
  },
  vehicleDisplayLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#999999',
    marginBottom: getAdaptiveMargin(screenDimensions, 4),
  },
  vehicleDisplayName: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#333333',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  vehiclePlateLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#999999',
    marginBottom: getAdaptiveMargin(screenDimensions, 4),
  },
  vehiclePlateNumber: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#333333',
  },
  progressIndicatorContainer: {
    marginBottom: getAdaptiveMargin(screenDimensions, 20),
  },
  progressBar: {
    height: getAdaptiveSize(screenDimensions, 4),
    backgroundColor: '#E0E0E0',
    borderRadius: getAdaptiveSize(screenDimensions, 2),
    overflow: 'hidden',
  },
  progressHandle: {
    position: 'absolute',
    width: getAdaptiveSize(screenDimensions, 20),
    height: getAdaptiveSize(screenDimensions, 8),
    backgroundColor: '#8A0000',
    borderRadius: getAdaptiveSize(screenDimensions, 4),
    top: getAdaptiveSize(screenDimensions, -2),
  },
  vehicleSelectionScroll: {
    marginHorizontal: -getAdaptivePadding(screenDimensions, 24),
  },
  vehicleSelectionScrollContent: {
    paddingHorizontal: getAdaptivePadding(screenDimensions, 24),
  },
  bookNowButton: {
    backgroundColor: '#8A0000',
    paddingVertical: getAdaptivePadding(screenDimensions, 16),
    paddingHorizontal: getAdaptivePadding(screenDimensions, 24),
    borderRadius: getAdaptiveSize(screenDimensions, 8),
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 16),
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookNowButtonText: {
    color: 'white',
    fontSize: getAdaptiveFontSize(screenDimensions, 18),
    fontWeight: 'bold',
  },
  bookNowButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getAdaptivePadding(screenDimensions, 40),
  },
  loadingText: {
    fontSize: getAdaptiveFontSize(screenDimensions, 16),
    color: '#8A0000',
    marginTop: getAdaptiveMargin(screenDimensions, 10),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: getAdaptivePadding(screenDimensions, 40),
  },
  emptyText: {
    fontSize: getAdaptiveFontSize(screenDimensions, 18),
    fontWeight: 'bold',
    color: '#8A0000',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  emptySubtext: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#666',
    textAlign: 'center',
  },
  activeStatus: {
    color: '#FF9800',
  },
  // New timestamp styles
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 4),
  },
  timestampLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#6B7280',
    fontWeight: '500',
  },
  timestampValue: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    color: '#333333',
    fontWeight: '600',
  },
  timestampDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  timestampDetailLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#6B7280',
    fontWeight: '500',
  },
  timestampDetailValue: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#333333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  reservedStatus: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    fontWeight: 'bold',
    color: '#FF9800',
  },
  // Vehicle Selection Modal Styles (from HomeScreen)
  vehicleTypeInfoContainer: {
    backgroundColor: '#F0F8FF',
    borderRadius: getAdaptiveSize(screenDimensions, 8),
    padding: getAdaptivePadding(screenDimensions, 12),
    marginBottom: getAdaptiveMargin(screenDimensions, 16),
    borderLeftWidth: 4,
    borderLeftColor: '#8A0000',
  },
  vehicleTypeInfoText: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#4A5568',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  vehicleSelectionCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#8A0000',
    borderRadius: getAdaptiveSize(screenDimensions, 12),
    padding: getAdaptivePadding(screenDimensions, 16),
    marginRight: getAdaptiveMargin(screenDimensions, 12),
    width: getAdaptiveSize(screenDimensions, 160),
    minHeight: getAdaptiveSize(screenDimensions, 200),
  },
  vehicleSelectionCardSelected: {
    borderWidth: 3,
    borderColor: '#8A0000',
  },
  vehicleSelectionIconContainer: {
    backgroundColor: '#8A0000',
    borderRadius: getAdaptiveSize(screenDimensions, 8),
    padding: getAdaptivePadding(screenDimensions, 12),
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 12),
    width: getAdaptiveSize(screenDimensions, 60),
    height: getAdaptiveSize(screenDimensions, 60),
    justifyContent: 'center',
    alignSelf: 'center',
  },
  vehicleSelectionLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 10),
    color: '#8A0000',
    marginBottom: getAdaptiveMargin(screenDimensions, 2),
  },
  vehicleSelectionValue: {
    fontSize: getAdaptiveFontSize(screenDimensions, 12),
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: getAdaptiveMargin(screenDimensions, 6),
  },
  vehicleSelectionProgressContainer: {
    marginVertical: getAdaptiveMargin(screenDimensions, 20),
    alignItems: 'center',
  },
  vehicleSelectionProgressTrack: {
    width: '100%',
    height: getAdaptiveSize(screenDimensions, 4),
    backgroundColor: '#E0E0E0',
    borderRadius: getAdaptiveSize(screenDimensions, 2),
    position: 'relative',
  },
  vehicleSelectionProgressHandle: {
    position: 'absolute',
    width: getAdaptiveSize(screenDimensions, 20),
    height: getAdaptiveSize(screenDimensions, 8),
    backgroundColor: '#8A0000',
    borderRadius: getAdaptiveSize(screenDimensions, 4),
    top: getAdaptiveSize(screenDimensions, -2),
  },
  vehicleSelectionBookNowButton: {
    backgroundColor: '#8A0000',
    borderRadius: getAdaptiveSize(screenDimensions, 8),
    paddingVertical: getAdaptivePadding(screenDimensions, 16),
    paddingHorizontal: getAdaptivePadding(screenDimensions, 32),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleSelectionBookNowButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  vehicleSelectionBookNowButtonText: {
    color: 'white',
    fontSize: getAdaptiveFontSize(screenDimensions, 16),
    fontWeight: 'bold',
  },
  // No Compatible Vehicles Styles
  noCompatibleVehiclesContainer: {
    padding: getAdaptivePadding(screenDimensions, 40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCompatibleVehiclesText: {
    fontSize: getAdaptiveFontSize(screenDimensions, 16),
    fontWeight: 'bold',
    color: '#8A0000',
    textAlign: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  noCompatibleVehiclesSubtext: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#666',
    textAlign: 'center',
    lineHeight: getAdaptiveFontSize(screenDimensions, 20),
  },
  // Vehicle Mismatch Modal Styles
  mismatchModalContainer: {
    backgroundColor: 'white',
    borderRadius: getAdaptiveSize(screenDimensions, 16),
    padding: getAdaptivePadding(screenDimensions, 24),
    margin: getAdaptiveMargin(screenDimensions, 20),
    maxWidth: '90%',
    alignSelf: 'center',
  },
  mismatchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 20),
  },
  mismatchModalTitle: {
    fontSize: getAdaptiveFontSize(screenDimensions, 20),
    fontWeight: 'bold',
    color: '#8A0000',
    flex: 1,
  },
  mismatchContent: {
    marginBottom: getAdaptiveMargin(screenDimensions, 24),
  },
  mismatchMessage: {
    fontSize: getAdaptiveFontSize(screenDimensions, 16),
    color: '#333',
    textAlign: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 20),
    lineHeight: getAdaptiveFontSize(screenDimensions, 24),
  },
  mismatchDetails: {
    backgroundColor: '#F8F9FA',
    borderRadius: getAdaptiveSize(screenDimensions, 8),
    padding: getAdaptivePadding(screenDimensions, 16),
    marginBottom: getAdaptiveMargin(screenDimensions, 16),
  },
  mismatchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getAdaptiveMargin(screenDimensions, 8),
  },
  mismatchLabel: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#666',
    fontWeight: '500',
  },
  mismatchValue: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#8A0000',
    fontWeight: 'bold',
  },
  mismatchSuggestion: {
    fontSize: getAdaptiveFontSize(screenDimensions, 14),
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: getAdaptiveFontSize(screenDimensions, 20),
  },
  mismatchCloseButton: {
    backgroundColor: '#8A0000',
    paddingVertical: getAdaptivePadding(screenDimensions, 12),
    paddingHorizontal: getAdaptivePadding(screenDimensions, 24),
    borderRadius: getAdaptiveSize(screenDimensions, 8),
    alignItems: 'center',
  },
  mismatchCloseButtonText: {
    color: 'white',
    fontSize: getAdaptiveFontSize(screenDimensions, 16),
    fontWeight: 'bold',
  },
});

// Styles are now in historyScreenStyles.ts

export default HistoryScreen;
