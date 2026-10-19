import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';
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
    const q = searchQuery.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return diseases.filter((d) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        (d.category || '').toLowerCase() === selectedCategory.toLowerCase();

      if (!tokens.length) return matchesCategory;

      const targetText = [
        d.name,
        d.common_name,
        d.symtom,
        d.solution,
        d.transmission,
        d.description,
        d.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = tokens.every((token) => targetText.includes(token));
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
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

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
            placeholder="Search condition (e.g. Breast cancer, Asthma)..."
            placeholderTextColor={colors.textSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextActive,
                ]}
                numberOfLines={1}
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
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading disease encyclopedia...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDiseases}
          keyExtractor={(item) => String(item.id || item.code || item.name)}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="book-outline" size={44} color={colors.textSoft} />
              <Text style={styles.emptyTitle}>No Conditions Found</Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? `No medical matches found for "${searchQuery}". Try a symptom or broader term.`
                  : 'No diseases found under the selected category filter.'}
              </Text>
              {searchQuery ? (
                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                >
                  <Text style={styles.clearSearchText}>Clear search filters</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const risk = getRiskBadge(item.risk_level);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setSelectedDisease(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    {item.common_name && (
                      <Text style={styles.cardCommonName}>Also known as: {item.common_name}</Text>
                    )}
                  </View>
                  <View style={[styles.riskBadge, { backgroundColor: risk.bg }]}>
                    <Text style={[styles.riskBadgeText, { color: risk.text }]}>
                      {risk.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardMetaRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{item.category || 'General'}</Text>
                  </View>
                </View>

                {item.symtom ? (
                  <View style={styles.symptomsPreview}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={15}
                      color={colors.textMuted}
                      style={{ marginRight: 6, marginTop: 1 }}
                    />
                    <Text style={styles.symptomsText} numberOfLines={2}>
                      <Text style={{ fontWeight: '700' }}>Symptoms: </Text>
                      {item.symtom}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.cardFooter}>
                  <Text style={styles.viewGuideText}>View Clinical Guide & Solutions</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selectedDisease}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDisease(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedDisease && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.modalTitle}>{selectedDisease.name}</Text>
                    {selectedDisease.common_name ? (
                      <Text style={styles.modalSubtitle}>{selectedDisease.common_name}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedDisease(null)}
                  >
                    <Ionicons name="close" size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                  <View style={styles.modalTagsRow}>
                    <View
                      style={[
                        styles.riskBadge,
                        { backgroundColor: getRiskBadge(selectedDisease.risk_level).bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.riskBadgeText,
                          { color: getRiskBadge(selectedDisease.risk_level).text },
                        ]}
                      >
                        {getRiskBadge(selectedDisease.risk_level).label}
                      </Text>
                    </View>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{selectedDisease.category}</Text>
                    </View>
                  </View>

                  {selectedDisease.description ? (
                    <View style={styles.detailBlock}>
                      <View style={styles.detailLabelRow}>
                        <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
                        <Text style={styles.detailLabel}>Clinical Overview</Text>
                      </View>
                      <Text style={styles.detailBody}>{selectedDisease.description}</Text>
                    </View>
                  ) : null}

                  {selectedDisease.symtom ? (
                    <View style={styles.detailBlock}>
                      <View style={styles.detailLabelRow}>
                        <Ionicons name="pulse-outline" size={17} color={colors.warning} />
                        <Text style={styles.detailLabel}>Key Symptoms & Indicators</Text>
                      </View>
                      <Text style={styles.detailBody}>{selectedDisease.symtom}</Text>
                    </View>
                  ) : null}

                  {selectedDisease.transmission ? (
                    <View style={styles.detailBlock}>
                      <View style={styles.detailLabelRow}>
                        <Ionicons name="git-network-outline" size={17} color={colors.textMuted} />
                        <Text style={styles.detailLabel}>Transmission & Etiology</Text>
                      </View>
                      <Text style={styles.detailBody}>{selectedDisease.transmission}</Text>
                    </View>
                  ) : null}

                  {selectedDisease.solution ? (
                    <View style={[styles.detailBlock, styles.solutionBlock]}>
                      <View style={styles.detailLabelRow}>
                        <Ionicons name="medkit-outline" size={17} color={colors.success} />
                        <Text style={[styles.detailLabel, { color: '#065F46' }]}>
                          Management & Clinical Guidance
                        </Text>
                      </View>
                      <Text style={[styles.detailBody, { color: '#064E3B' }]}>
                        {selectedDisease.solution}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    height: '100%',
  },
  categoryContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryList: {
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
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
    color: '#fff',
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
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
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
    fontWeight: '900',
    color: colors.text,
  },
  cardCommonName: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '900',
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
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
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
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
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
    fontWeight: '800',
    color: colors.primary,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 28,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 280,
  },
  clearSearchBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
  },
  clearSearchText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
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
    gap: 14,
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
    gap: 6,
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  detailBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
    fontWeight: '500',
  },
});
