import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SharedHeader from '../../components/SharedHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import {
  whiteStarIconSvg,
  maroonStarIconSvg,
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

const { width, height } = Dimensions.get('window');

interface Feedback {
  feedback_id: number;
  user_id: number;
  content: string;
  rating: number;
  status: string;
  created_at: string;
  subscription_id?: number;
}

interface FeedbackComment {
  feedback_comment_id: number;
  feedback_id: number;
  user_id: number;
  role: string;
  comment: string;
  created_at: string;
}

const MyFeedbackScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const screenDimensions = useScreenDimensions();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [feedbackComments, setFeedbackComments] = useState<FeedbackComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const styles = createHistoryScreenStyles(screenDimensions, colors);

  useFocusEffect(
    React.useCallback(() => {
      loadFeedbackList();
    }, [])
  );

  const loadFeedbackList = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Starting feedback list load...');
      
      // Get user's feedback list
      const response = await ApiService.getUserFeedback();
      
      console.log('📥 API Response:', response);
      console.log('📥 Response success:', response.success);
      console.log('📥 Response data:', response.data);
      console.log('📥 Response data.feedback:', response.data?.feedback);
      
      if (response.success && response.data && response.data.feedback) {
        // Ensure we have an array
        const feedback = Array.isArray(response.data.feedback) ? response.data.feedback : [];
        setFeedbackList(feedback);
        console.log('✅ Loaded feedback list:', feedback.length, 'items');
        console.log('✅ Feedback items:', feedback);
      } else {
        // Handle case where API returns success but no data
        setFeedbackList([]);
        console.warn('⚠️ No feedback data in response:', response);
        console.warn('⚠️ Response.success:', response.success);
        console.warn('⚠️ Response.data exists:', !!response.data);
        console.warn('⚠️ Response.data.feedback exists:', !!response.data?.feedback);
      }
    } catch (error) {
      console.error('❌ Error loading feedback list:', error);
      setError('Failed to load your feedback');
      setFeedbackList([]); // Set to empty array to prevent .map() errors
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeedbackList();
    setRefreshing(false);
  };

  const navigateToFeedbackDetail = async (feedbackId: number) => {
    try {
      console.log('🔍 Tapping feedback item:', feedbackId);
      setLoadingDetails(true);
      setModalVisible(true);
      
      // Find the feedback from the list
      const feedback = feedbackList.find(f => f.feedback_id === feedbackId);
      console.log('🔍 Found feedback:', feedback);
      
      if (feedback) {
        setSelectedFeedback(feedback);
        console.log('✅ Set selected feedback:', feedback);
        
        // Load comments for this feedback
        console.log('🔍 Loading comments for feedbackId:', feedbackId);
        const response = await ApiService.getFeedbackDetails(feedbackId);
        console.log('📥 Feedback details response:', response);
        
        if (response.success) {
          // Ensure comments is always an array
          const commentsArray = Array.isArray(response.data.comments) 
            ? response.data.comments 
            : (response.data.comments ? [response.data.comments] : []);
          setFeedbackComments(commentsArray);
          console.log('✅ Set comments array:', commentsArray);
        } else {
          console.warn('⚠️ Failed to load feedback details:', response.message);
        }
      } else {
        console.error('❌ Feedback not found in list:', feedbackId);
      }
    } catch (error) {
      console.error('❌ Error loading feedback details:', error);
      Alert.alert('Error', 'Failed to load feedback details');
      setModalVisible(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedFeedback(null);
    setFeedbackComments([]);
    setNewComment('');
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedFeedback) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      setSubmittingComment(true);
      
      // Call API to submit comment
      const response = await ApiService.addFeedbackComment(selectedFeedback.feedback_id, newComment.trim());
      
      if (response.success) {
        setNewComment('');
        // Refresh comments
        await loadFeedbackComments(selectedFeedback.feedback_id);
        Alert.alert('Success', 'Comment submitted successfully');
      } else {
        throw new Error(response.message || 'Failed to submit comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      Alert.alert('Error', 'Failed to submit comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const loadFeedbackComments = async (feedbackId: number) => {
    try {
      const response = await ApiService.getFeedbackDetails(feedbackId);
      if (response.success) {
        const commentsArray = Array.isArray(response.data.comments) 
          ? response.data.comments 
          : (response.data.comments ? [response.data.comments] : []);
        setFeedbackComments(commentsArray);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  // Profile picture component (same as HistoryScreen)
  const ProfilePicture = ({ size = 100 }: { size?: number }) => {
    const getInitials = () => {
      if (!user) return '?';
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const profileImageUrl = (user as any)?.profile_image || (user as any)?.profile_image_url;

    if (profileImageUrl) {
      return (
        <View style={[styles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={{ color: 'white', fontSize: size / 3, fontWeight: 'bold' }}>{getInitials()}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ color: 'white', fontSize: size / 3, fontWeight: 'bold' }}>{getInitials()}</Text>
      </View>
    );
  };

  const renderStars = (rating: number, size: number = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <View key={i} style={{ marginRight: 2 }}>
          <SvgXml
            xml={i <= rating ? maroonStarIconSvg : whiteStarIconSvg}
            width={size}
            height={size}
          />
        </View>
      );
    }
    return <View style={{ flexDirection: 'row' }}>{stars}</View>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  return (
    <View style={styles.container}>
      <SharedHeader 
        title="My Feedback" 
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
              <Text style={styles.userName}>MY FEEDBACK</Text>
              <Text style={styles.userEmail}>YOUR RATINGS AND ADMIN REPLIES</Text>
            </View>
          </View>

          <ScrollView 
            style={styles.profileCardScroll} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Feedback Items */}
            <View style={styles.spotsContainer}>
              <Text style={styles.spotsTitle}>Your Feedback</Text>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading your feedback...</Text>
                </View>
              ) : error ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{error}</Text>
                  <TouchableOpacity
                    style={styles.bookNowButton}
                    onPress={loadFeedbackList}
                  >
                    <Text style={styles.bookNowButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : feedbackList.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No feedback yet</Text>
                  <Text style={styles.emptySubtext}>Rate the app from your profile to see your feedback here</Text>
                  <TouchableOpacity
                    style={styles.bookNowButton}
                    onPress={() => router.push('/ProfileScreen')}
                  >
                    <Text style={styles.bookNowButtonText}>Go to Profile</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                feedbackList.map((feedback) => (
                  <TouchableOpacity 
                    key={feedback.feedback_id} 
                    style={styles.parkingCard}
                    onPress={() => navigateToFeedbackDetail(feedback.feedback_id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.locationHeader}>
                      <View style={styles.locationTextContainer}>
                        <Text style={styles.parkingLocation}>Rating: {feedback.rating}/5</Text>
                        <Text style={styles.parkingSpotId}>FB-{feedback.feedback_id}</Text>
                      </View>
                      <Ionicons 
                        name="star" 
                        size={32} 
                        color={feedback.rating >= 4 ? '#4CAF50' : feedback.rating >= 3 ? '#FFA500' : '#FF4444'} 
                      />
                    </View>
                    
                    <Text style={styles.parkingLabel}>Your Rating</Text>
                    <View style={styles.timeSlotContainer}>
                      {renderStars(feedback.rating)}
                    </View>
                    
                    <Text style={styles.parkingLabel}>Your Comment</Text>
                    <Text style={styles.timestampDetailValue}>
                      {feedback.content || 'No additional comments provided'}
                    </Text>
                    
                    <View style={styles.timestampRow}>
                      <Text style={styles.timestampLabel}>Submitted:</Text>
                      <Text style={styles.timestampValue}>
                        {formatDate(feedback.created_at)}
                      </Text>
                    </View>
                    
                    <View style={styles.timestampDetailRow}>
                      <Text style={styles.timestampDetailLabel}>Tap to view admin replies</Text>
                      <Ionicons name="chevron-forward" size={16} color="#8A0000" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Feedback Details Modal - Like Reservation Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reservationModalContainer}>
            <View style={styles.reservationModalHeader}>
              <Text style={styles.reservationModalTitle}>Feedback Details</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#8A0000" />
              </TouchableOpacity>
            </View>
            
            {loadingDetails ? (
              <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 40,
              }}>
                <ActivityIndicator size="large" color="#8A0000" />
                <Text style={{
                  fontSize: 16,
                  color: '#666',
                  marginTop: 8,
                }}>Loading feedback details...</Text>
              </View>
            ) : selectedFeedback ? (
              <ScrollView style={styles.reservationModalContent}>
                <View style={styles.reservationDetailCard}>
                  <View style={styles.reservationDetailHeader}>
                    <Text style={styles.reservationLocation}>Rating: {selectedFeedback.rating}/5</Text>
                    <Text style={styles.reservationId}>FB-{selectedFeedback.feedback_id}</Text>
                  </View>
                  
                  <View style={styles.reservationDetailSection}>
                    <Text style={styles.reservationDetailLabel}>Your Rating</Text>
                    <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 16 }}>
                      {renderStars(selectedFeedback.rating, 20)}
                    </View>
                    
                    <Text style={styles.reservationDetailLabel}>Your Comment</Text>
                    <Text style={[styles.reservationDetailSubValue, { marginTop: 8, marginBottom: 16 }]}>
                      {selectedFeedback.content || 'No additional comments provided'}
                    </Text>
                    
                    <View style={styles.timestampDetailRow}>
                      <Text style={styles.timestampDetailLabel}>Submitted:</Text>
                      <Text style={styles.timestampDetailValue}>
                        {formatDate(selectedFeedback.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Comments Section */}
                <View style={styles.reservationDetailCard}>
                  <View style={styles.reservationDetailSection}>
                    <Text style={styles.reservationDetailLabel}>Admin Replies & Comments</Text>
                    
                    {feedbackComments.length === 0 ? (
                      <View style={{
                        backgroundColor: '#F8F9FA',
                        borderRadius: 8,
                        padding: 16,
                        alignItems: 'center',
                        marginTop: 8,
                      }}>
                        <Text style={{
                          fontSize: 14,
                          color: '#6B7280',
                        }}>No replies yet</Text>
                      </View>
                    ) : (
                      feedbackComments.map((comment) => (
                        <View key={comment.feedback_comment_id} style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          marginTop: 8,
                          elevation: 1,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.22,
                          shadowRadius: 2.22,
                        }}>
                          <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 8,
                          }}>
                            <Text style={{
                              fontSize: 12,
                              color: '#6B7280',
                            }}>
                              {formatDate(comment.created_at)}
                            </Text>
                            <View style={{ width: 60 }} />
                          </View>
                          <Text style={{
                            fontSize: 14,
                            color: '#333',
                            lineHeight: 18,
                          }}>{comment.comment}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                {/* Add Comment Section */}
                <View style={styles.reservationDetailCard}>
                  <View style={styles.reservationDetailSection}>
                    <Text style={styles.reservationDetailLabel}>Add a Comment</Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      marginTop: 8,
                    }}>
                      <TextInput
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: '#333',
                          minHeight: 80,
                          marginRight: 8,
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          borderRadius: 8,
                          padding: 12,
                          backgroundColor: '#FFFFFF',
                        }}
                        placeholder="Type your comment here..."
                        value={newComment}
                        onChangeText={setNewComment}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        placeholderTextColor="#9CA3AF"
                      />
                      <TouchableOpacity
                        style={[
                          {
                            backgroundColor: '#8A0000',
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            justifyContent: 'center',
                            alignItems: 'center',
                          },
                          (!newComment.trim() || submittingComment) && { backgroundColor: '#D1D5DB' }
                        ]}
                        onPress={handleSubmitComment}
                        disabled={!newComment.trim() || submittingComment}
                      >
                        {submittingComment ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <SvgXml
                            xml={`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M15.5 8L0.5 1L7.5 8L0.5 15L15.5 8Z" fill="white"/>
</svg>`}
                            width={16}
                            height={16}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MyFeedbackScreen;
