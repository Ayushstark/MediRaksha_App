import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getCurrentProfile,
  getDoctorSlots,
  publishDoctorSlotsSchedule,
  publishDoctorSlot,
  deleteDoctorSlot,
  deleteDoctorSlotsByRange,
  toDateString,
  formatTime12Hour,
  formatSlotDateFull,
  formatSlotDateBadge,
} from '../services/medirakshaApi';
import { colors, shadows } from '../constants/theme';

export interface DoctorSlot {
  id: number | string;
  _id?: string;
  bookingDate: string;
  date?: string;
  slotTime: string;
  time?: string;
  status: 'available' | 'booked' | 'blocked';
  created_at?: string;
}

export interface WeeklyRule {
  dayOfWeek: number;
  label: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_WEEKLY_RULES: WeeklyRule[] = [
  { dayOfWeek: 1, label: 'Mon', enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 2, label: 'Tue', enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 3, label: 'Wed', enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 4, label: 'Thu', enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 5, label: 'Fri', enabled: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 6, label: 'Sat', enabled: false, startTime: '10:00', endTime: '13:00' },
  { dayOfWeek: 0, label: 'Sun', enabled: false, startTime: '10:00', endTime: '13:00' },
];

const DURATION_OPTIONS = [
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
];

const COMMON_START_TIMES = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00'];
const COMMON_END_TIMES = ['13:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

export default function AddAvailability() {
  const router = useRouter();

  // Slots Data State
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Mode Selection: "generator" (Weekly recurring range matching web version) or "single" (quick single slot)
  const [mode, setMode] = useState<'generator' | 'single'>('generator');

  // Generator State (matches mediraksha2.0 exactly)
  const todayStr = useMemo(() => toDateString(new Date()), []);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return toDateString(nextWeek);
  });
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(60);
  const [weeklyRules, setWeeklyRules] = useState<WeeklyRule[]>(DEFAULT_WEEKLY_RULES);

  // Single Slot Mode State (with direct manual typing and clock selection)
  const [singleDate, setSingleDate] = useState(todayStr);
  const [singleStartTime, setSingleStartTime] = useState('09:00');
  const [singleEndTime, setSingleEndTime] = useState('10:00');
  const [startInputText, setStartInputText] = useState('09:00 AM');
  const [endInputText, setEndInputText] = useState('10:00 AM');

  // Time Picker Modal State (Native clock dialog)
  const [timePickerTarget, setTimePickerTarget] = useState<'singleStart' | 'singleEnd' | null>(null);

  // Filter State (matches web version exactly)
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'booked' | 'blocked'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Date Pickers Visibility
  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    field: 'start' | 'end' | 'single' | 'from' | 'to';
    currentValue: string;
  }>({
    visible: false,
    field: 'start',
    currentValue: todayStr,
  });

  // Time Editor Modal for dayOfWeek rule
  const [editingRule, setEditingRule] = useState<{
    dayOfWeek: number;
    field: 'start' | 'end';
    currentTime: string;
  } | null>(null);

  // Time conversion helper utilities
  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
    return h * 60 + m;
  };

  const minutesToTime = (totalMinutes: number) => {
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const timeToDate = (timeStr: string) => {
    const d = new Date();
    if (!timeStr) return d;
    const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const dateToTimeString = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const parseTimeTo24H = (value: string): string | null => {
    if (typeof value !== 'string') return null;
    const str = value.trim();
    const match24 = str.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
    if (match24) {
      const hours = parseInt(match24[1], 10).toString().padStart(2, '0');
      return `${hours}:${match24[2]}`;
    }
    const match12 = str.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = match12[2];
      const ampm = (match12[3] || '').toUpperCase();
      if (hours < 1 || hours > 12) return null;
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    return null;
  };

  const handleStartTimeChange = (newStartTime: string) => {
    setSingleStartTime(newStartTime);
    setStartInputText(formatTime12Hour(newStartTime));
    const startM = timeToMinutes(newStartTime);
    const endM = timeToMinutes(singleEndTime);
    if (endM <= startM) {
      const autoEnd = minutesToTime(startM + 30);
      setSingleEndTime(autoEnd);
      setEndInputText(formatTime12Hour(autoEnd));
    }
  };

  const handleEndTimeChange = (newEndTime: string) => {
    setSingleEndTime(newEndTime);
    setEndInputText(formatTime12Hour(newEndTime));
  };

  const handleStartTextChange = (text: string) => {
    setStartInputText(text);
    const parsed = parseTimeTo24H(text);
    if (parsed) {
      setSingleStartTime(parsed);
      const startM = timeToMinutes(parsed);
      const endM = timeToMinutes(singleEndTime);
      if (endM <= startM) {
        const autoEnd = minutesToTime(startM + 30);
        setSingleEndTime(autoEnd);
        setEndInputText(formatTime12Hour(autoEnd));
      }
    }
  };

  const handleStartTextBlur = () => {
    const parsed = parseTimeTo24H(startInputText);
    if (parsed) {
      setSingleStartTime(parsed);
      setStartInputText(formatTime12Hour(parsed));
    } else {
      setStartInputText(formatTime12Hour(singleStartTime));
    }
  };

  const handleEndTextChange = (text: string) => {
    setEndInputText(text);
    const parsed = parseTimeTo24H(text);
    if (parsed) {
      setSingleEndTime(parsed);
    }
  };

  const handleEndTextBlur = () => {
    const parsed = parseTimeTo24H(endInputText);
    if (parsed) {
      setSingleEndTime(parsed);
      setEndInputText(formatTime12Hour(parsed));
    } else {
      setEndInputText(formatTime12Hour(singleEndTime));
    }
  };

  const applyDurationOffset = (minutesToAdd: number) => {
    const startM = timeToMinutes(singleStartTime);
    const newEnd = minutesToTime(startM + minutesToAdd);
    setSingleEndTime(newEnd);
    setEndInputText(formatTime12Hour(newEnd));
  };

  // Fetch slots on filter change
  useEffect(() => {
    fetchSlots();
  }, [statusFilter, fromDate, toDate]);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const data = await getDoctorSlots(params);
      setSlots(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRule = (dayOfWeek: number, changes: Partial<WeeklyRule>) => {
    setWeeklyRules((prev) =>
      prev.map((rule) => (rule.dayOfWeek === dayOfWeek ? { ...rule, ...changes } : rule))
    );
  };

  // Publish slots using exact web logic
  const handlePublishSlots = async () => {
    if (mode === 'single') {
      if (!singleDate || !singleStartTime || !singleEndTime) {
        Alert.alert('Missing Details', 'Please select date, start time, and end time.');
        return;
      }

      const startMin = timeToMinutes(singleStartTime);
      const endMin = timeToMinutes(singleEndTime);

      if (endMin <= startMin) {
        Alert.alert('Invalid Time Range', 'End time must be later than start time.');
        return;
      }

      const duration = endMin - startMin;

      setPublishing(true);
      try {
        const res = await publishDoctorSlot({
          bookingDate: singleDate,
          startTime: singleStartTime,
          endTime: singleEndTime,
          slotDurationMinutes: duration,
        });

        if (res?.success) {
          Alert.alert('Success', res.message || 'Slot published successfully!');
          await fetchSlots();
        } else {
          Alert.alert('Notice', res?.message || 'Slot published.');
          await fetchSlots();
        }
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.message || error.message || 'Could not publish slot.');
      } finally {
        setPublishing(false);
      }
      return;
    }

    // Weekly Generator Mode (matching web version)
    const enabledRules = weeklyRules.filter((rule) => rule.enabled);

    if (!startDate || !endDate) {
      Alert.alert('Selection Required', 'Select a start and end date before publishing.');
      return;
    }

    if (endDate < startDate) {
      Alert.alert('Invalid Range', 'End date cannot be earlier than start date.');
      return;
    }

    if (enabledRules.length === 0) {
      Alert.alert('No Days Selected', 'Enable at least one working day to generate slots.');
      return;
    }

    setPublishing(true);
    try {
      const response = await publishDoctorSlotsSchedule({
        startDate,
        endDate,
        slotDurationMinutes,
        weeklyRules: enabledRules.map(({ dayOfWeek, startTime, endTime }) => ({
          dayOfWeek,
          startTime,
          endTime,
        })),
      });

      if (response?.success) {
        Alert.alert(
          'Slots Published',
          response.message || `${response.data?.length || 0} slot(s) published successfully!`
        );
        await fetchSlots();
      } else {
        Alert.alert('Notice', response?.message || 'Slots generation completed.');
        await fetchSlots();
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Failed to publish slots.';
      Alert.alert('Publish Error', msg);
    } finally {
      setPublishing(false);
    }
  };

  // Delete single slot (matching web version)
  const handleDeleteSlot = async (slot: DoctorSlot) => {
    if (slot.status === 'booked') {
      Alert.alert('Cannot Delete', 'Booked slots cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Slot',
      `Delete slot on ${formatSlotDateFull(slot.bookingDate || slot.date)} at ${formatTime12Hour(slot.slotTime || slot.time)}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const slotId = slot.id || slot._id;
            if (!slotId) return;
            setDeletingId(slotId);
            try {
              const res = await deleteDoctorSlot(slotId);
              if (res?.success) {
                setSlots((prev) => prev.filter((item) => (item.id || item._id) !== slotId));
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Could not delete slot.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  // Delete slots by range (matching web version)
  const handleDeleteSlotsByRange = async () => {
    if (!fromDate || !toDate) {
      Alert.alert('Range Required', 'Select both From and To dates to delete a range.');
      return;
    }

    if (toDate < fromDate) {
      Alert.alert('Invalid Range', 'End date must be the same as or later than start date.');
      return;
    }

    Alert.alert(
      'Delete Range',
      `Delete all unbooked slots between ${formatSlotDateBadge(fromDate)} and ${formatSlotDateBadge(toDate)}? Booked appointments will remain safe.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete Range',
          style: 'destructive',
          onPress: async () => {
            setBulkDeleting(true);
            try {
              const res = await deleteDoctorSlotsByRange(fromDate, toDate);
              if (res?.success) {
                Alert.alert(
                  'Success',
                  res.message || `Deleted ${res.deletedCount} unbooked slot(s).`
                );
                fetchSlots();
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete range.');
            } finally {
              setBulkDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Slot groups by date
  const groupedSlots = useMemo(() => {
    const groups: Record<string, DoctorSlot[]> = {};
    slots.forEach((slot) => {
      const d = slot.bookingDate || slot.date || '';
      if (!groups[d]) groups[d] = [];
      groups[d].push(slot);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [slots]);

  // Status style helper (matching web version)
  const renderStatusBadge = (status: DoctorSlot['status']) => {
    const config = {
      available: { label: 'Available', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
      booked: { label: 'Booked', bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
      blocked: { label: 'Blocked', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
    }[status] || { label: status, bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bg, borderColor: config.border }]}>
        <Text style={[styles.statusBadgeText, { color: config.text }]}>{config.label}</Text>
      </View>
    );
  };

  // Date picker handler
  const handleDateSelected = (selected: Date) => {
    const dateStr = toDateString(selected);
    const field = pickerConfig.field;
    setPickerConfig({ visible: false, field: 'start', currentValue: todayStr });

    if (field === 'start') {
      setStartDate(dateStr);
      if (!endDate || endDate < dateStr) setEndDate(dateStr);
    } else if (field === 'end') {
      setEndDate(dateStr);
    } else if (field === 'single') {
      setSingleDate(dateStr);
    } else if (field === 'from') {
      setFromDate(dateStr);
    } else if (field === 'to') {
      setToDate(dateStr);
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A237E" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Publish Slots</Text>
          <Text style={styles.headerSubtitle}>Configure your schedule & generate slots</Text>
        </View>
        <TouchableOpacity onPress={fetchSlots} style={styles.headerIconBtn} accessibilityLabel="Refresh slots">
          <Ionicons name="reload" size={18} color="#1A237E" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* MODE TOGGLE TABS */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'generator' && styles.modeTabActive]}
            onPress={() => setMode('generator')}
          >
            <Ionicons
              name="calendar"
              size={15}
              color={mode === 'generator' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.modeTabText, mode === 'generator' && styles.modeTabTextActive]}>
              Weekly Schedule Generator
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, mode === 'single' && styles.modeTabActive]}
            onPress={() => setMode('single')}
          >
            <Ionicons
              name="time"
              size={15}
              color={mode === 'single' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.modeTabText, mode === 'single' && styles.modeTabTextActive]}>
              Quick Single Slot
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── GENERATOR CARD (EXACT WEB LOGIC) ── */}
        {mode === 'generator' ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={18} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Weekly Availability</Text>
                <Text style={styles.cardSubtitle}>Generate recurring slot blocks for a date range</Text>
              </View>
            </View>

            {/* Start and End Date Inputs */}
            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() =>
                    setPickerConfig({ visible: true, field: 'start', currentValue: startDate })
                  }
                >
                  <Ionicons name="calendar-outline" size={16} color="#1A237E" />
                  <Text style={styles.dateBtnText}>{formatSlotDateBadge(startDate)}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() =>
                    setPickerConfig({ visible: true, field: 'end', currentValue: endDate })
                  }
                >
                  <Ionicons name="calendar-outline" size={16} color="#1A237E" />
                  <Text style={styles.dateBtnText}>{formatSlotDateBadge(endDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Meeting Length / Duration Selector */}
            <Text style={styles.fieldLabel}>Meeting Length</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.durationBtn,
                    slotDurationMinutes === opt.value && styles.durationBtnActive,
                  ]}
                  onPress={() => setSlotDurationMinutes(opt.value)}
                >
                  <Text
                    style={[
                      styles.durationBtnText,
                      slotDurationMinutes === opt.value && styles.durationBtnTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weekly Rules Table (Matches Web Weekly Rules Exactly) */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Working Days & Hours</Text>
            <View style={styles.rulesList}>
              {weeklyRules.map((rule) => (
                <View
                  key={rule.dayOfWeek}
                  style={[styles.ruleRow, !rule.enabled && styles.ruleRowDisabled]}
                >
                  {/* Day Checkbox */}
                  <TouchableOpacity
                    style={styles.ruleDayToggle}
                    onPress={() => updateRule(rule.dayOfWeek, { enabled: !rule.enabled })}
                  >
                    <Ionicons
                      name={rule.enabled ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={rule.enabled ? '#4F46E5' : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.ruleDayLabel,
                        rule.enabled && styles.ruleDayLabelActive,
                      ]}
                    >
                      {rule.label}
                    </Text>
                  </TouchableOpacity>

                  {/* Start Time Pill */}
                  <TouchableOpacity
                    style={[styles.timePill, !rule.enabled && styles.timePillDisabled]}
                    disabled={!rule.enabled}
                    onPress={() =>
                      setEditingRule({
                        dayOfWeek: rule.dayOfWeek,
                        field: 'start',
                        currentTime: rule.startTime,
                      })
                    }
                  >
                    <Text style={styles.timePillSub}>From</Text>
                    <Text style={styles.timePillValue}>{formatTime12Hour(rule.startTime)}</Text>
                  </TouchableOpacity>

                  {/* End Time Pill */}
                  <TouchableOpacity
                    style={[styles.timePill, !rule.enabled && styles.timePillDisabled]}
                    disabled={!rule.enabled}
                    onPress={() =>
                      setEditingRule({
                        dayOfWeek: rule.dayOfWeek,
                        field: 'end',
                        currentTime: rule.endTime,
                      })
                    }
                  >
                    <Text style={styles.timePillSub}>To</Text>
                    <Text style={styles.timePillValue}>{formatTime12Hour(rule.endTime)}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Generate Slots Button */}
            <TouchableOpacity
              style={[styles.publishBtn, (publishing || !startDate || !endDate) && styles.btnDisabled]}
              onPress={handlePublishSlots}
              disabled={publishing || !startDate || !endDate}
            >
              {publishing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={styles.publishBtnText}>Generate Slots</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* ── QUICK SINGLE SLOT CARD (MANUAL START & END TIME SELECTION) ── */
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="time" size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Quick Slot Publisher</Text>
                <Text style={styles.cardSubtitle}>Manually select start & end time</Text>
              </View>
            </View>

            {/* Date Selection */}
            <Text style={styles.fieldLabel}>Date</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() =>
                setPickerConfig({ visible: true, field: 'single', currentValue: singleDate })
              }
            >
              <Ionicons name="calendar-outline" size={18} color="#1A237E" />
              <Text style={styles.dateBtnText}>{formatSlotDateFull(singleDate)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            {/* Start Time & End Time Row (Side-by-Side) */}
            <View style={styles.timeSelectionRow}>
              {/* Start Time Box */}
              <View style={styles.timeBox}>
                <View style={styles.timeBoxHeader}>
                  <Text style={styles.timeBoxLabel}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.clockHeaderBtn}
                    onPress={() => setTimePickerTarget('singleStart')}
                    accessibilityLabel="Pick start time with clock"
                  >
                    <Ionicons name="time" size={13} color="#1A237E" />
                    <Text style={styles.clockHeaderBtnText}>Clock</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.timeInputCard}>
                  <TextInput
                    style={styles.timeTextInput}
                    value={startInputText}
                    onChangeText={handleStartTextChange}
                    onBlur={handleStartTextBlur}
                    placeholder="09:00 AM"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    onPress={() => setTimePickerTarget('singleStart')}
                    style={styles.inputClockTouch}
                    accessibilityLabel="Open clock for start time"
                  >
                    <Ionicons name="time-outline" size={18} color="#1A237E" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.timeHelpText}>Type (e.g. 9:05) or tap clock</Text>
              </View>

              {/* End Time Box */}
              <View style={styles.timeBox}>
                <View style={styles.timeBoxHeader}>
                  <Text style={styles.timeBoxLabel}>End Time</Text>
                  <TouchableOpacity
                    style={[styles.clockHeaderBtn, { backgroundColor: '#ECFDF5' }]}
                    onPress={() => setTimePickerTarget('singleEnd')}
                    accessibilityLabel="Pick end time with clock"
                  >
                    <Ionicons name="time" size={13} color="#059669" />
                    <Text style={[styles.clockHeaderBtnText, { color: '#059669' }]}>Clock</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.timeInputCard}>
                  <TextInput
                    style={styles.timeTextInput}
                    value={endInputText}
                    onChangeText={handleEndTextChange}
                    onBlur={handleEndTextBlur}
                    placeholder="10:00 AM"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    onPress={() => setTimePickerTarget('singleEnd')}
                    style={styles.inputClockTouch}
                    accessibilityLabel="Open clock for end time"
                  >
                    <Ionicons name="time-outline" size={18} color="#059669" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.timeHelpText}>Type (e.g. 9:30) or tap clock</Text>
              </View>
            </View>

            {/* Quick Duration Shortcuts */}
            <Text style={styles.fieldSubLabel}>Quick set end time from start:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickDurationScroll}>
              {[
                { label: '+15m', minutes: 15 },
                { label: '+30m', minutes: 30 },
                { label: '+45m', minutes: 45 },
                { label: '+1 hr', minutes: 60 },
                { label: '+1.5 hr', minutes: 90 },
                { label: '+2 hr', minutes: 120 },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.quickDurationChip}
                  onPress={() => applyDurationOffset(item.minutes)}
                >
                  <Text style={styles.quickDurationChipText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Validation Banner if End Time is earlier/equal to Start Time */}
            {timeToMinutes(singleEndTime) <= timeToMinutes(singleStartTime) && (
              <View style={styles.invalidRangeBanner}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.invalidRangeText}>
                  End time ({formatTime12Hour(singleEndTime)}) must be later than start time ({formatTime12Hour(singleStartTime)}).
                </Text>
              </View>
            )}

            {/* Publish Button */}
            {(() => {
              const startM = timeToMinutes(singleStartTime);
              const endM = timeToMinutes(singleEndTime);
              const isInvalid = endM <= startM;

              return (
                <TouchableOpacity
                  style={[styles.publishBtn, (publishing || isInvalid) && styles.btnDisabled]}
                  onPress={handlePublishSlots}
                  disabled={publishing || isInvalid}
                >
                  {publishing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={18} color="#fff" />
                      <Text style={styles.publishBtnText}>
                        Publish Slot ({formatTime12Hour(singleStartTime)} – {formatTime12Hour(singleEndTime)})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })()}
          </View>
        )}

        {/* ── PUBLISHED SLOTS MANAGEMENT (EXACT WEB LOGIC) ── */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="time" size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Published Slots</Text>
              <Text style={styles.cardSubtitle}>
                {slots.length} slot{slots.length !== 1 ? 's' : ''} visible
              </Text>
            </View>
            <TouchableOpacity onPress={fetchSlots} style={styles.refreshIcon}>
              <Ionicons name="refresh" size={16} color="#4F46E5" />
            </TouchableOpacity>
          </View>

          {/* Filters Bar: Status & Date Range */}
          <Text style={styles.fieldLabel}>Filter By Status</Text>
          <View style={styles.filterPillsRow}>
            {(['all', 'available', 'booked', 'blocked'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterPill,
                  statusFilter === status && styles.filterPillActive,
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === status && styles.filterPillTextActive,
                  ]}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date Range Filter Inputs */}
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>From Date</Text>
              <TouchableOpacity
                style={styles.dateBtnSmall}
                onPress={() =>
                  setPickerConfig({
                    visible: true,
                    field: 'from',
                    currentValue: fromDate || todayStr,
                  })
                }
              >
                <Text style={styles.dateBtnSmallText}>
                  {fromDate ? formatSlotDateBadge(fromDate) : 'Any Date'}
                </Text>
                {fromDate ? (
                  <TouchableOpacity onPress={() => setFromDate('')}>
                    <Ionicons name="close-circle" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>To Date</Text>
              <TouchableOpacity
                style={styles.dateBtnSmall}
                onPress={() =>
                  setPickerConfig({
                    visible: true,
                    field: 'to',
                    currentValue: toDate || todayStr,
                  })
                }
              >
                <Text style={styles.dateBtnSmallText}>
                  {toDate ? formatSlotDateBadge(toDate) : 'Any Date'}
                </Text>
                {toDate ? (
                  <TouchableOpacity onPress={() => setToDate('')}>
                    <Ionicons name="close-circle" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>

          {/* Delete Range Action Bar (Matches web version) */}
          {fromDate && toDate && (
            <View style={styles.deleteRangeBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deleteRangeText}>
                  Range: {formatSlotDateBadge(fromDate)} → {formatSlotDateBadge(toDate)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.deleteRangeBtn, bulkDeleting && styles.btnDisabled]}
                onPress={handleDeleteSlotsByRange}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={14} color="#fff" />
                    <Text style={styles.deleteRangeBtnText}>Delete Range</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Slots List by Date */}
          {loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#1A237E" />
              <Text style={styles.loadingText}>Loading published slots...</Text>
            </View>
          ) : slots.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No slots published</Text>
              <Text style={styles.emptySubtitle}>
                Choose dates and generate your availability above.
              </Text>
            </View>
          ) : (
            groupedSlots.map(([dateKey, daySlots]) => (
              <View key={dateKey} style={styles.dateGroup}>
                <View style={styles.dateGroupHeader}>
                  <Text style={styles.dateGroupTitle}>{formatSlotDateFull(dateKey)}</Text>
                  <Text style={styles.dateGroupCount}>
                    {daySlots.length} slot{daySlots.length !== 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={styles.slotGridWrap}>
                  {daySlots.map((slot) => {
                    const slotId = slot.id || slot._id;
                    const isDeleting = deletingId === slotId;
                    const isBooked = slot.status === 'booked';
                    return (
                      <View key={slotId} style={styles.slotCard}>
                        <View style={styles.slotCardInfo}>
                          <View style={styles.slotTimeRow}>
                            <Ionicons name="time-outline" size={13} color="#1A237E" />
                            <Text style={styles.slotTimeText}>
                              {formatTime12Hour(slot.slotTime || slot.time)}
                            </Text>
                          </View>
                          {renderStatusBadge(slot.status)}
                        </View>

                        <TouchableOpacity
                          style={[styles.slotDeleteBtn, isBooked && styles.slotDeleteBtnDisabled]}
                          disabled={isBooked || isDeleting}
                          onPress={() => handleDeleteSlot(slot)}
                          accessibilityLabel={isBooked ? 'Booked slots cannot be deleted' : 'Delete slot'}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={isBooked ? '#CBD5E1' : '#DC2626'}
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* DATE PICKER MODAL */}
      {pickerConfig.visible && (
        <DateTimePicker
          value={
            pickerConfig.currentValue
              ? new Date(`${pickerConfig.currentValue}T00:00:00`)
              : new Date()
          }
          mode="date"
          minimumDate={pickerConfig.field === 'start' || pickerConfig.field === 'single' ? new Date() : undefined}
          onChange={(event, date) => {
            if (date) {
              handleDateSelected(date);
            } else {
              setPickerConfig((p) => ({ ...p, visible: false }));
            }
          }}
        />
      )}

      {/* TIME EDITOR MODAL FOR WORKING HOURS */}
      {editingRule && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.timeEditorModal}>
              <Text style={styles.modalTitle}>
                Set {editingRule.field === 'start' ? 'Start' : 'End'} Time for{' '}
                {DEFAULT_WEEKLY_RULES.find((r) => r.dayOfWeek === editingRule.dayOfWeek)?.label}
              </Text>
              <Text style={styles.modalSub}>Pick from standard working hours:</Text>

              <View style={styles.timeChoicesGrid}>
                {(editingRule.field === 'start' ? COMMON_START_TIMES : COMMON_END_TIMES).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timeChoiceBtn,
                      editingRule.currentTime === t && styles.timeChoiceBtnActive,
                    ]}
                    onPress={() => {
                      if (editingRule.field === 'start') {
                        updateRule(editingRule.dayOfWeek, { startTime: t });
                      } else {
                        updateRule(editingRule.dayOfWeek, { endTime: t });
                      }
                      setEditingRule(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.timeChoiceText,
                        editingRule.currentTime === t && styles.timeChoiceTextActive,
                      ]}
                    >
                      {formatTime12Hour(t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingRule(null)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* NATIVE TIME PICKER MODAL */}
      {timePickerTarget && (
        <DateTimePicker
          value={timeToDate(timePickerTarget === 'singleStart' ? singleStartTime : singleEndTime)}
          mode="time"
          is24Hour={false}
          onChange={(event, date) => {
            const target = timePickerTarget;
            setTimePickerTarget(null);
            if (date) {
              const timeStr = dateToTimeString(date);
              if (target === 'singleStart') {
                handleStartTimeChange(timeStr);
              } else {
                handleEndTimeChange(timeStr);
              }
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1A237E' },
  headerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 1 },
  headerIconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#EEF2FF' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeTabActive: { backgroundColor: '#1A237E' },
  modeTabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  modeTabTextActive: { color: '#FFFFFF' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  cardSubtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  halfCol: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  dateBtnText: { fontSize: 13, fontWeight: '700', color: '#1A237E' },
  dateBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateBtnSmallText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  durationBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  durationBtnActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  durationBtnText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  durationBtnTextActive: { color: '#FFFFFF' },

  rulesList: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 8, gap: 6 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ruleRowDisabled: { opacity: 0.5, backgroundColor: '#F8FAFC' },
  ruleDayToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 70 },
  ruleDayLabel: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  ruleDayLabelActive: { color: '#1E293B' },

  timePill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  timePillDisabled: { opacity: 0.5 },
  timePillSub: { fontSize: 9, fontWeight: '700', color: '#94A3B8' },
  timePillValue: { fontSize: 12, fontWeight: '800', color: '#1A237E' },

  publishBtn: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  publishBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },

  quickTimeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  quickTimeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickTimeBtnActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  quickTimeBtnText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  quickTimeBtnTextActive: { color: '#FFFFFF' },

  refreshIcon: { padding: 6, borderRadius: 8, backgroundColor: '#EEF2FF' },
  filterPillsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  filterPillText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  filterPillTextActive: { color: '#FFFFFF' },

  deleteRangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  deleteRangeText: { fontSize: 11, fontWeight: '700', color: '#9F1239' },
  deleteRangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  deleteRangeBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  emptyContainer: { alignItems: 'center', paddingVertical: 30 },
  loadingText: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginTop: 8 },
  emptySubtitle: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },

  dateGroup: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateGroupTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  dateGroupCount: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  slotGridWrap: { gap: 6 },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotCardInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slotTimeText: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  slotDeleteBtn: { padding: 4 },
  slotDeleteBtnDisabled: { opacity: 0.3 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  timeEditorModal: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#64748B', marginBottom: 14 },
  timeChoicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  timeChoiceBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeChoiceBtnActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  timeChoiceText: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  timeChoiceTextActive: { color: '#FFFFFF' },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: '#64748B' },

  timeSelectionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  timeBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeBoxLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  clockHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  clockHeaderBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A237E',
  },
  timeInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginTop: 2,
    marginBottom: 4,
  },
  timeTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
    paddingVertical: 6,
  },
  inputClockTouch: {
    padding: 4,
  },
  timeHelpText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  fieldSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    marginTop: 4,
  },
  quickDurationScroll: {
    gap: 8,
    paddingBottom: 10,
  },
  quickDurationChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickDurationChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  invalidRangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  invalidRangeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});
