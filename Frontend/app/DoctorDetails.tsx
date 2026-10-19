import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { AppButton, AppChip, AppHeader, EmptyState } from '../components/ui/AppUI';
import { colors, radius, shadows, spacing } from '../constants/theme';
import { getDoctors, formatSlotDateBadge, formatTime12Hour } from '../services/medirakshaApi';
import { fetchReviews, submitReview, Review } from '../services/reviewService';

export default function DoctorDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Community Reviews State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadDoctor = async () => {
      try {
        const doctors = await getDoctors();
        const found = doctors.find((item: any) =>
          String(item.id || item._id) === String(params.doctorId || '') ||
          String(item.name || '').toLowerCase() === String(params.doctorName || '').toLowerCase()
        );
        setDoctor(found || {
          id: params.doctorId,
          name: params.doctorName || 'Selected Doctor',
          specialization: params.specialty || 'General Physician',
          hospital: params.hospitalName || 'MediRaksha Clinic',
          availableSlots: params.availability ? JSON.parse(String(params.availability)) : [],
        });
      } catch {
        setDoctor({
          id: params.doctorId,
          name: params.doctorName || 'Selected Doctor',
          specialization: params.specialty || 'General Physician',
          hospital: params.hospitalName || 'MediRaksha Clinic',
          availableSlots: [],
        });
      } finally {
        setLoading(false);
      }
    };

    loadDoctor();
  }, [params.availability, params.doctorId, params.doctorName, params.hospitalName, params.specialty]);

  useEffect(() => {
    const loadReviews = async () => {
      const docId = doctor?.id || doctor?._id || params.doctorId;
      if (!docId) return;
      try {
        setLoadingReviews(true);
        const data = await fetchReviews('doctor', docId);
        setReviews(data);
      } catch (e) {
        console.warn('Reviews load error:', e);
      } finally {
        setLoadingReviews(false);
      }
    };

    loadReviews();
  }, [doctor?.id, doctor?._id, params.doctorId]);

  const handleAddReview = async () => {
    const docId = doctor?.id || doctor?._id || params.doctorId;
    if (!docId) return;
    try {
      setSubmitting(true);
      const created = await submitReview({
        entityType: 'doctor',
        entityId: docId,
        rating: newRating,
        reviewText: newComment.trim() || undefined,
        authorName: newAuthor.trim() || 'Patient',
      });
      if (created) {
        setReviews((prev) => [created, ...prev]);
        setReviewModalOpen(false);
        setNewComment('');
        Alert.alert('Thank you!', 'Your review has been submitted.');
      }
    } catch (err: any) {
      Alert.alert('Review Error', err.message || 'Unable to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const availableSlots = useMemo(() =>
    (doctor?.availableSlots || []).filter((slot: any) => slot.status !== 'booked'),
    [doctor]
  );

  const bookDoctor = (selectedSlot?: any) => {
    router.push({
      pathname: '/BookAppointment',
      params: {
        doctorId: doctor?.id || doctor?._id || params.doctorId,
        doctorName: doctor?.name || params.doctorName,
        availability: JSON.stringify(doctor?.availableSlots || []),
        directSlot: 'true',
        initialDate: selectedSlot ? (selectedSlot.bookingDate || selectedSlot.date) : (params.initialDate as string | undefined),
        initialSlotId: selectedSlot ? (selectedSlot.id || selectedSlot._id) : (params.initialSlotId as string | undefined),
        initialSlotTime: selectedSlot ? (selectedSlot.slotTime || selectedSlot.time) : (params.initialSlotTime as string | undefined),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading doctor profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title={`Dr. ${doctor?.name || 'Doctor'}`}
        subtitle="Profile, consultation details, published slots, and patient feedback."
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <LinearGradient colors={['#1A237E', '#3762F0']} style={styles.avatar}>
            <FontAwesome5 name="user-md" size={30} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>Dr. {doctor?.name}</Text>
            <Text style={styles.speciality}>{doctor?.specialization || doctor?.specialty || 'General Physician'}</Text>
            <Text style={styles.hospital}>{doctor?.hospital || 'MediRaksha Clinic'}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Metric label="Experience" value={doctor?.experience || doctor?.exp || '10+ yrs'} />
          <Metric label="Fee" value={`₹${doctor?.fee || 500}`} />
          <Metric label="Rating" value={`${doctor?.rating || '4.8'} ★`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Published Slots</Text>
          {availableSlots.length ? (
            <View style={styles.slotWrap}>
              {availableSlots.slice(0, 16).map((slot: any) => {
                const badge = formatSlotDateBadge(slot.bookingDate || slot.date);
                const timeText = formatTime12Hour(slot.slotTime || slot.time);
                return (
                  <AppChip
                    key={slot.id || slot._id || `${slot.bookingDate}-${slot.slotTime}`}
                    label={`${badge ? `${badge} • ` : ''}${timeText}`}
                    onPress={() => bookDoctor(slot)}
                  />
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="time-outline"
              title="No published slots"
              subtitle="This doctor has not published available timings yet."
            />
          )}
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="star" size={20} color={colors.warning} />
              <Text style={styles.reviewTitle}>Patient Reviews & Ratings</Text>
            </View>
            <TouchableOpacity
              style={styles.writeReviewButton}
              onPress={() => setReviewModalOpen(true)}
            >
              <Feather name="edit-3" size={14} color={colors.primaryMid} />
              <Text style={styles.writeReviewButtonText}>Write Review</Text>
            </TouchableOpacity>
          </View>

          {loadingReviews ? (
            <ActivityIndicator size="small" color={colors.primaryMid} style={{ marginTop: 12 }} />
          ) : reviews.length === 0 ? (
            <Text style={styles.reviewText}>
              No reviews yet. Be the first patient to share feedback for Dr. {doctor?.name}!
            </Text>
          ) : (
            <View style={styles.reviewList}>
              {reviews.map((rev) => (
                <View key={rev.id} style={styles.reviewItem}>
                  <View style={styles.reviewMetaRow}>
                    <Text style={styles.reviewAuthor}>{rev.authorName || 'Verified Patient'}</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= rev.rating ? 'star' : 'star-outline'}
                          size={13}
                          color={colors.warning}
                        />
                      ))}
                    </View>
                  </View>
                  {rev.reviewText ? (
                    <Text style={styles.reviewContent}>{rev.reviewText}</Text>
                  ) : null}
                  {rev.created_at && (
                    <Text style={styles.reviewDate}>
                      {new Date(rev.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <AppButton
          title="Book Appointment"
          onPress={bookDoctor}
          icon={<Ionicons name="calendar-outline" size={19} color="#fff" />}
          style={styles.bookButton}
        />

        {/* Write Review Modal */}
        <Modal
          visible={reviewModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Review Dr. {doctor?.name}</Text>
                <TouchableOpacity onPress={() => setReviewModalOpen(false)}>
                  <Feather name="x" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalRatingLabel}>Your Overall Rating</Text>
              <View style={styles.interactiveStarRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setNewRating(s)}>
                    <Ionicons
                      name={s <= newRating ? 'star' : 'star-outline'}
                      size={32}
                      color={colors.warning}
                      style={{ marginHorizontal: 4 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder="Share your consultation experience (optional)..."
                placeholderTextColor={colors.textSoft}
                multiline
                numberOfLines={3}
                value={newComment}
                onChangeText={setNewComment}
              />

              <TextInput
                style={[styles.modalInput, { height: 44, marginTop: 8 }]}
                placeholder="Your Name (defaults to Patient)"
                placeholderTextColor={colors.textSoft}
                value={newAuthor}
                onChangeText={setNewAuthor}
              />

              <View style={styles.modalActions}>
                <AppButton
                  title={submitting ? 'Submitting...' : 'Submit Review'}
                  onPress={handleAddReview}
                  disabled={submitting}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { color: colors.textMuted, fontWeight: '700', marginTop: spacing.md },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  profileCard: {
    marginTop: -18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatar: { width: 66, height: 66, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  name: { color: colors.text, fontSize: 20, fontWeight: '900' },
  speciality: { color: colors.primary, fontWeight: '900', marginTop: 4 },
  hospital: { color: colors.textMuted, fontWeight: '600', marginTop: 5 },
  statsGrid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  metric: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  metricLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: 4 },
  section: { marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.md },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginLeft: spacing.sm },
  writeReviewButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  writeReviewButtonText: { color: colors.primaryMid, fontSize: 12, fontWeight: '800', marginLeft: 4 },
  reviewText: { color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm, fontWeight: '600' },
  reviewList: { marginTop: 12, gap: 10 },
  reviewItem: { backgroundColor: colors.surfaceMuted, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  reviewMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewAuthor: { fontSize: 13, fontWeight: '800', color: colors.text },
  starRow: { flexDirection: 'row', gap: 2 },
  reviewContent: { fontSize: 13, color: colors.text, marginTop: 6, lineHeight: 18, fontWeight: '500' },
  reviewDate: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  modalRatingLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  interactiveStarRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  modalInput: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, color: colors.text, fontSize: 14, textAlignVertical: 'top' },
  modalActions: { marginTop: 16, flexDirection: 'row' },
  bookButton: { marginTop: spacing.xl },
});
