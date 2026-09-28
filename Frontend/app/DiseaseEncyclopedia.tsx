import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows, typography } from '../constants/theme';
import { AppButton, AppChip, EmptyState } from '../components/ui/AppUI';
import { Disease, fetchAllDiseases } from '../services/diseaseService';

export default function DiseaseEncyclopediaScreen() {
  const router = useRouter();
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);

  const loadData = async () => {
    try {
      const data = await fetchAllDiseases();
      setDiseases(data);
    } catch (e) {
      console.warn('Failed to load diseases:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    diseases.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set);
  }, [diseases]);

  const filteredDiseases = useMemo(() => {
    return diseases.filter((d) => {
      const matchesCategory = selectedCategory === 'All' || d.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.common_name && d.common_name.toLowerCase().includes(q)) ||
        (d.symtom && d.symtom.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [diseases, selectedCategory, searchQuery]);

  const getRiskBadge = (level?: string) => {
    const l = (level || 'low').toLowerCase();
    if (l === 'high') {
      return { bg: colors.dangerSoft, text: colors.danger, label: 'High Risk' };
    }
    if (l === 'medium') {
      return { bg: colors.warningSoft, text: colors.warning, label: 'Moderate' };
    }
    return { bg: colors.successSoft, text: colors.success, label: 'Low Risk' };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Disease Encyclopedia</Text>
          <Text style={styles.headerSubtitle}>Medical symptoms, risk tiers & care guidelines</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search diseases, conditions or symptoms..."
            placeholderTextColor={colors.textSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Disease List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primaryMid} />
          <Text style={styles.loadingText}>Loading disease index...</Text>
        </View>
      ) : filteredDiseases.length === 0 ? (
        <EmptyState
          title="No Conditions Found"
          description="Try searching for another medical term or change the category filter."
          icon={<MaterialCommunityIcons name="book-search-outline" size={40} color={colors.textMuted} />}
        />
      ) : (
        <FlatList
          data={filteredDiseases}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              colors={[colors.primaryMid]}
            />
          }
          renderItem={({ item }) => {
            const risk = getRiskBadge(item.risk_level);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => setSelectedDisease(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    {item.common_name && (
                      <Text style={styles.cardCommonName}>({item.common_name})</Text>
                    )}
                  </View>
                  <View style={[styles.riskBadge, { backgroundColor: risk.bg }]}>
                    <Text style={[styles.riskBadgeText, { color: risk.text }]}>{risk.label}</Text>
                  </View>
                </View>

                {item.category && (
                  <View style={styles.cardMetaRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{item.category}</Text>
                    </View>
                  </View>
                )}

                {item.symtom ? (
                  <View style={styles.symptomsPreview}>
                    <Feather name="activity" size={13} color={colors.primaryMid} style={{ marginRight: 4 }} />
                    <Text style={styles.symptomsText} numberOfLines={2}>
                      <Text style={{ fontWeight: '700', color: colors.text }}>Symptoms: </Text>
                      {item.symtom}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.cardFooter}>
                  <Text style={styles.viewGuideText}>View Clinical Guidelines</Text>
                  <Feather name="chevron-right" size={16} color={colors.primaryMid} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Disease Detail Modal */}
      <Modal
        visible={!!selectedDisease}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedDisease(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedDisease && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{selectedDisease.name}</Text>
                    {selectedDisease.common_name && (
                      <Text style={styles.modalSubtitle}>Also known as: {selectedDisease.common_name}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedDisease(null)}
                  >
                    <Feather name="x" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                  {/* Category & Risk */}
                  <View style={styles.modalTagsRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{selectedDisease.category || 'General'}</Text>
                    </View>
                    {selectedDisease.risk_level && (
                      <View style={[styles.riskBadge, { backgroundColor: getRiskBadge(selectedDisease.risk_level).bg }]}>
                        <Text style={[styles.riskBadgeText, { color: getRiskBadge(selectedDisease.risk_level).text }]}>
                          {getRiskBadge(selectedDisease.risk_level).label}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Description */}
                  {selectedDisease.description && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>Overview</Text>
                      <Text style={styles.detailBody}>{selectedDisease.description}</Text>
                    </View>
                  )}

                  {/* Symptoms */}
                  {selectedDisease.symtom && (
                    <View style={styles.detailBlock}>
                      <View style={styles.detailLabelRow}>
                        <Feather name="alert-circle" size={15} color={colors.danger} />
                        <Text style={[styles.detailLabel, { marginLeft: 6 }]}>Common Symptoms</Text>
                      </View>
                      <Text style={styles.detailBody}>{selectedDisease.symtom}</Text>
                    </View>
                  )}

                  {/* Transmission */}
                  {selectedDisease.transmission && (
                    <View style={styles.detailBlock}>
                      <View style={styles.detailLabelRow}>
                        <Feather name="git-branch" size={15} color={colors.warning} />
                        <Text style={[styles.detailLabel, { marginLeft: 6 }]}>Transmission / Causes</Text>
                      </View>
                      <Text style={styles.detailBody}>{selectedDisease.transmission}</Text>
                    </View>
                  )}

                  {/* Solution / Prevention */}
                  {selectedDisease.solution && (
                    <View style={[styles.detailBlock, styles.solutionBlock]}>
                      <View style={styles.detailLabelRow}>
                        <Feather name="shield" size={15} color={colors.success} />
                        <Text style={[styles.detailLabel, { color: colors.success, marginLeft: 6 }]}>
                          Clinical Care & Solutions
                        </Text>
                      </View>
                      <Text style={styles.detailBody}>{selectedDisease.solution}</Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.modalFooter}>
                  <AppButton
                    title="Done"
                    variant="primary"
                    onPress={() => setSelectedDisease(null)}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  categoryContainer: {
    backgroundColor: colors.surface,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  categoryTextActive: {
    color: colors.textInverse,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  cardCommonName: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardMetaRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  categoryBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: colors.primaryMid,
    fontSize: 11,
    fontWeight: '700',
  },
  symptomsPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    padding: 10,
    borderRadius: radius.sm,
    marginTop: 10,
  },
  symptomsText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  viewGuideText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryMid,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  modalScroll: {
    paddingVertical: 16,
    gap: 16,
  },
  modalTagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailBlock: {
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  solutionBlock: {
    backgroundColor: colors.successSoft,
    borderColor: '#A7F3D0',
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  detailBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    fontWeight: '500',
  },
  modalFooter: {
    paddingTop: 10,
  },
});
