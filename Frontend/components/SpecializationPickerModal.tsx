import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { DOCTOR_SPECIALIZATIONS, SpecializationOption } from '../constants/specializations';

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedValue?: string;
  onSelect: (specialization: SpecializationOption) => void;
}

export default function SpecializationPickerModal({
  visible,
  onClose,
  selectedValue,
  onSelect,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set<string>();
    DOCTOR_SPECIALIZATIONS.forEach((s) => set.add(s.category));
    return ['All', ...Array.from(set)];
  }, []);

  const filteredSpecializations = useMemo(() => {
    return DOCTOR_SPECIALIZATIONS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  const handleSelect = (item: SpecializationOption) => {
    onSelect(item);
    setSearch('');
    setSelectedCategory('All');
    onClose();
  };

  const handleClose = () => {
    setSearch('');
    setSelectedCategory('All');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalRoot}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTagRow}>
              <Text style={styles.modalTitle}>Medical Specialization</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#15803D" />
                <Text style={styles.verifiedText}>Doctor Only</Text>
              </View>
            </View>
            <Text style={styles.modalSubtitle}>
              Select your accredited medical specialty
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Search Box */}
        <View style={styles.modalSearchBox}>
          <Feather name="search" size={18} color="#64748B" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.modalSearchInput}
            placeholder="Search specialty (e.g. Heart, Skin, Surgeon)..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories Horizontal Scroll */}
        <View style={styles.categoryContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Specialization List */}
        <FlatList
          data={filteredSpecializations}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.specListContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selectedValue?.toLowerCase() === item.value.toLowerCase();
            return (
              <TouchableOpacity
                style={[styles.specItemCard, isSelected && styles.specItemCardSelected]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.specIconWrap,
                    isSelected && { backgroundColor: '#1A237E' },
                  ]}
                >
                  <FontAwesome5
                    name={(item.icon as any) || 'stethoscope'}
                    size={18}
                    color={isSelected ? '#fff' : '#1A237E'}
                  />
                </View>

                <View style={styles.specItemContent}>
                  <View style={styles.specItemHeaderRow}>
                    <Text style={[styles.specItemTitle, isSelected && styles.specItemTitleSelected]}>
                      {item.label}
                    </Text>
                    <View style={styles.specCategoryTag}>
                      <Text style={styles.specCategoryTagText}>{item.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.specItemDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>

                {isSelected ? (
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="stethoscope" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Medical Specialization Found</Text>
              <Text style={styles.emptyText}>
                No official medical specialty matches "{search}". Arbitrary non-medical terms are restricted.
              </Text>
              <TouchableOpacity
                style={styles.emptyResetBtn}
                onPress={() => {
                  setSearch('');
                  setSelectedCategory('All');
                }}
              >
                <Text style={styles.emptyResetText}>View All Specializations</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  headerTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A237E' },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  modalCloseBtn: { padding: 6 },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: '#1E293B' },
  categoryContainer: { paddingBottom: 8, backgroundColor: '#F8FAFC' },
  categoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  categoryPillText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  categoryPillTextActive: { color: '#fff' },
  specListContent: { padding: 16, paddingBottom: 40 },
  specItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specItemCardSelected: {
    borderColor: '#1A237E',
    backgroundColor: '#F0F3FF',
    borderWidth: 1.5,
  },
  specIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  specItemContent: { flex: 1, marginRight: 8 },
  specItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  specItemTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  specItemTitleSelected: { color: '#1A237E' },
  specCategoryTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specCategoryTagText: { fontSize: 10, fontWeight: '600', color: '#475569' },
  specItemDescription: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A237E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyResetBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1A237E',
    borderRadius: 10,
  },
  emptyResetText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
