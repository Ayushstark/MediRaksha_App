import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { AppButton, AppChip, EmptyState, ErrorState, LoadingState } from '../components/ui/AppUI';
import { useToast } from '../components/ui/ToastProvider';
import { colors } from '../constants/theme';
import {
  ALLOWED_REPORT_MIME_TYPES,
  deletePatientReport,
  createReportCollection,
  getReportWorkspace,
  savePatientHealthSummary,
  getAssignedDoctor,
  getPatientReportById,
  getPatientReports,
  getPreviewType,
  getReportDataUri,
  LinkedDoctor,
  MAX_REPORT_FILE_SIZE_BYTES,
  MedicalReport,
  PatientHealthSummary,
  ReportCollection,
  PreviewType,
  REPORT_CATEGORIES,
  ReportCategory,
  ReportVisibility,
  uploadPatientReport,
  togglePinReport,
  toggleImportantReport,
  toggleArchiveReport,
} from '../services/reportsApi';

export default function MedicalReportsScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [assignedDoctor, setAssignedDoctor] = useState<LinkedDoctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [pendingFile, setPendingFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReportCategory>('lab');
  const [activeCategory, setActiveCategory] = useState<ReportCategory | 'all'>('all');
  const [visibility, setVisibility] = useState<ReportVisibility>('private');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState('');
  const [previewType, setPreviewType] = useState<PreviewType>('other');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'collections' | 'timeline' | 'summary'>('overview');
  const [collections, setCollections] = useState<ReportCollection[]>([]);
  const [healthSummary, setHealthSummary] = useState<PatientHealthSummary | null>(null);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState<PatientHealthSummary>({});
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  const fetchReports = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setFetchError('');
      const [reportRows, doctor, workspace] = await Promise.all([
        getPatientReports(),
        getAssignedDoctor(),
        getReportWorkspace().catch(() => ({ reports: [], summary: null, collections: [] })),
      ]);
      setReports(workspace.reports.length ? workspace.reports : reportRows);
      setHealthSummary(workspace.summary);
      setCollections(workspace.collections);
      setAssignedDoctor(doctor);
    } catch (error: any) {
      console.warn('Reports unavailable:', error?.response?.status || error?.message);
      if (error?.response?.status === 401) {
        router.replace('/Login');
        return;
      }
      setFetchError('Failed to load your medical records. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const categoryCounts = useMemo(() => {
    const categoryStats = REPORT_CATEGORIES.map((item) => ({
      ...item,
      count: reports.filter(report => String(report.category).toLowerCase() === item.value).length,
    }));
    return [
      { value: 'all' as const, label: 'All Files', count: reports.length },
      ...categoryStats,
    ];
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (activeCategory === 'all') return reports;
    return reports.filter(report => String(report.category).toLowerCase() === activeCategory);
  }, [activeCategory, reports]);

  const validateFile = (file: DocumentPicker.DocumentPickerAsset) => {
    const mimeType = file.mimeType || '';
    if (!ALLOWED_REPORT_MIME_TYPES.includes(mimeType)) {
      showToast({ type: 'error', message: 'Only PDF and image files are allowed.' });
      return false;
    }
    if ((file.size || 0) > MAX_REPORT_FILE_SIZE_BYTES) {
      showToast({ type: 'error', message: 'File is too large. Maximum size is 5MB.' });
      return false;
    }
    return true;
  };

  const selectDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];
    if (!validateFile(file)) return;
    setPendingFile(file);
    setTitle(file.name?.replace(/\.[^/.]+$/, '') || '');
    setCategory('lab');
    setVisibility('private');
    setUploadModalOpen(true);
  };

  const handleUpload = async () => {
    if (!pendingFile || !title.trim()) {
      showToast({ type: 'error', message: 'Please provide a title and select a file.' });
      return;
    }
    if (visibility === 'doctor' && !assignedDoctor) {
      showToast({ type: 'error', message: 'No linked doctor found. Link a doctor before sharing.' });
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadPatientReport({
        file: pendingFile,
        title,
        category,
        visibility,
        doctorId: assignedDoctor?.id,
      });
      setReports(prev => [uploaded, ...prev]);
      showToast({ type: 'success', message: 'Medical record uploaded successfully.' });
      setUploadModalOpen(false);
      setPendingFile(null);
      setTitle('');
      setCategory('lab');
      setVisibility('private');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Upload failed. Please try again.';
      showToast({ type: 'error', message });
      if (error.response?.status === 401) router.replace('/Login');
    } finally {
      setUploading(false);
    }
  };

  const openReport = async (report: MedicalReport) => {
    try {
      setSelectedReport(report);
      const fullReport = await getPatientReportById(report.id);
      if (!fullReport.fileData) {
        showToast({ type: 'error', message: 'File data is missing for this record.' });
        return;
      }
      setPreviewType(getPreviewType(fullReport.mimeType, fullReport.originalFileName));
      setPreviewUri(getReportDataUri(fullReport));
      setPreviewOpen(true);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to load file preview.';
      showToast({ type: 'error', message });
      if (error.response?.status === 401) router.replace('/Login');
    }
  };

  const confirmDelete = (report: MedicalReport) => {
    Alert.alert(
      'Delete medical record?',
      `Delete "${report.title || report.originalFileName}" permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePatientReport(report.id);
              setReports(prev => prev.filter(item => item.id !== report.id));
              showToast({ type: 'success', message: 'File deleted from health vault.' });
            } catch (error: any) {
              showToast({ type: 'error', message: error.response?.data?.message || 'Failed to delete record.' });
            }
          },
        },
      ]
    );
    setActionMenuOpen(false);
  };

  const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString() : 'Unknown date';
  const formatBytes = (bytes = 0) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  const formatCategoryLabel = (value: string) => {
    const normalized = String(value || 'other').toLowerCase();
    return REPORT_CATEGORIES.find(item => item.value === normalized)?.label
      || normalized.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const timelineReports = useMemo(() => [...reports].sort((a, b) => new Date(b.visitDate || b.createdAt || b.created_at || 0).getTime() - new Date(a.visitDate || a.createdAt || a.created_at || 0).getTime()), [reports]);

  const openSummaryEditor = () => {
    setSummaryDraft(healthSummary || {});
    setSummaryModalOpen(true);
  };

  const saveSummary = async () => {
    setSavingWorkspace(true);
    try {
      const saved = await savePatientHealthSummary(summaryDraft);
      setHealthSummary(saved);
      setSummaryModalOpen(false);
      showToast({ type: 'success', message: 'Health summary updated.' });
    } catch (error: any) {
      showToast({ type: 'error', message: error?.response?.data?.message || 'Could not save health summary.' });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    setSavingWorkspace(true);
    try {
      const created = await createReportCollection(newCollectionName.trim(), newCollectionDescription.trim());
      setCollections(prev => [{ ...created, recordCount: 0, recentRecords: [] }, ...prev]);
      setNewCollectionName('');
      setNewCollectionDescription('');
      setCollectionModalOpen(false);
      showToast({ type: 'success', message: 'Collection created.' });
    } catch (error: any) {
      showToast({ type: 'error', message: error?.response?.data?.message || 'Could not create collection.' });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const categoryIcon = (value: string) => {
    if (value === 'all') return 'albums-outline';
    if (value === 'lab') return 'flask';
    if (value === 'prescription') return 'document-text';
    if (value === 'scan') return 'scan-outline';
    return 'folder-outline';
  };

  const categoryColor = (value: string) => {
    if (value === 'all') return '#1A237E';
    if (value === 'lab') return '#16A34A';
    if (value === 'prescription') return '#F97316';
    if (value === 'scan') return '#2563EB';
    return '#7C3AED';
  };

  const renderReportCard = ({ item }: { item: MedicalReport }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => openReport(item)}
      onLongPress={() => {
        setSelectedReport(item);
        setActionMenuOpen(true);
      }}
      activeOpacity={0.84}
    >
      <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor(String(item.category))}18` }]}>
        <Ionicons name={categoryIcon(String(item.category)) as any} size={24} color={categoryColor(String(item.category))} />
      </View>
      <View style={styles.reportInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          {item.recordId ? (
            <View style={styles.recordIdTag}>
              <Text style={styles.recordIdTagText}>{String(item.recordId)}</Text>
            </View>
          ) : <View />}
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {item.isPinned ? <Ionicons name="pin" size={13} color="#2563EB" /> : null}
            {item.isImportant ? <Ionicons name="star" size={13} color="#F59E0B" /> : null}
            {item.isArchived ? <Ionicons name="archive" size={13} color="#94A3B8" /> : null}
          </View>
        </View>
        <Text style={styles.reportTitle} numberOfLines={2}>{item.title || item.originalFileName}</Text>
        <Text style={styles.reportFileName} numberOfLines={1}>{item.originalFileName}</Text>
        {item.tags && item.tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 4 }}>
            {item.tags.map((t, idx) => (
              <View key={idx} style={styles.tagChip}>
                <Text style={styles.tagChipText}>#{t.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { borderColor: `${categoryColor(String(item.category))}33` }]}>
            <Ionicons name="pricetag" size={11} color={categoryColor(String(item.category))} />
            <Text style={[styles.metaChipText, { color: categoryColor(String(item.category)) }]}>
              {formatCategoryLabel(String(item.category))}
            </Text>
          </View>
          <View style={[styles.privacyChip, item.visibility === 'doctor' && styles.doctorChip]}>
            <Ionicons name={item.visibility === 'doctor' ? 'eye' : 'shield-checkmark'} size={12} color={item.visibility === 'doctor' ? '#2563EB' : '#64748B'} />
            <Text style={[styles.privacyText, item.visibility === 'doctor' && styles.doctorChipText]}>
              {item.visibility === 'doctor' ? 'Doctor Access' : 'Private'}
            </Text>
          </View>
          <View style={styles.fileTypeChip}>
            <Ionicons
              name={getPreviewType(item.mimeType, item.originalFileName) === 'pdf' ? 'document-text' : 'image'}
              size={12}
              color="#64748B"
            />
            <Text style={styles.fileTypeText}>
              {getPreviewType(item.mimeType, item.originalFileName).toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.reportFooter}>
          {formatDate(item.created_at || item.createdAt)} • {formatBytes(item.fileSize)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.moreButton}
        onPress={() => {
          setSelectedReport(item);
          setActionMenuOpen(true);
        }}
      >
        <Feather name="more-vertical" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) return <LoadingState label="Loading your medical records..." />;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A237E', '#3949AB']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerEyebrow}>Patient Health Vault</Text>
          <Text style={styles.headerTitle}>Medical Records</Text>
          <Text style={styles.headerSubtitle}>Securely store and manage your health reports.</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.reportCount}>{reports.length}</Text>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workspaceTabs}>
        {[
          { key: 'overview' as const, label: 'Overview', icon: 'grid-outline' },
          { key: 'collections' as const, label: 'Collections', icon: 'layers-outline' },
          { key: 'timeline' as const, label: 'Timeline', icon: 'time-outline' },
          { key: 'summary' as const, label: 'Health Summary', icon: 'heart-outline' },
        ].map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.workspaceTab, workspaceTab === tab.key && styles.workspaceTabActive]} onPress={() => setWorkspaceTab(tab.key)}>
            <Ionicons name={tab.icon as any} size={16} color={workspaceTab === tab.key ? '#fff' : '#64748B'} />
            <Text style={[styles.workspaceTabText, workspaceTab === tab.key && styles.workspaceTabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {workspaceTab === 'collections' ? (
        <ScrollView contentContainerStyle={styles.workspaceContent} showsVerticalScrollIndicator={false}>
          <View style={styles.workspaceHeadingRow}><View><Text style={styles.workspaceTitle}>Your Collections</Text><Text style={styles.workspaceSubtitle}>Group records around a condition, visit, or family member.</Text></View><TouchableOpacity style={styles.addCollectionButton} onPress={() => setCollectionModalOpen(true)}><Ionicons name="add" size={18} color="#fff" /><Text style={styles.addCollectionText}>New</Text></TouchableOpacity></View>
          {collections.length === 0 ? <EmptyState icon="layers-outline" title="No collections yet" subtitle="Create a collection to organize related medical records." /> : collections.map(collection => <View key={collection.id} style={styles.collectionCard}><View style={styles.collectionIcon}><Ionicons name="layers" size={22} color="#1A237E" /></View><View style={{ flex: 1 }}><Text style={styles.collectionName}>{collection.name}</Text><Text style={styles.collectionDescription}>{collection.description || 'No description added'}</Text><Text style={styles.collectionMeta}>{collection.recordCount ?? collection.recentRecords?.length ?? 0} records</Text></View><Ionicons name="chevron-forward" size={20} color="#94A3B8" /></View>)}
        </ScrollView>
      ) : workspaceTab === 'timeline' ? (
        <ScrollView contentContainerStyle={styles.workspaceContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.workspaceTitle}>Medical Timeline</Text><Text style={styles.workspaceSubtitle}>A chronological view of your uploaded records and visits.</Text>
          {timelineReports.length === 0 ? <EmptyState icon="time-outline" title="No timeline events" subtitle="Uploaded reports will appear here chronologically." /> : <View style={styles.timeline}>{timelineReports.map((report, index) => <View key={report.id} style={styles.timelineRow}><View style={styles.timelineRail}><View style={styles.timelineDot} />{index < timelineReports.length - 1 ? <View style={styles.timelineLine} /> : null}</View><View style={styles.timelineCard}><Text style={styles.timelineDate}>{new Date(report.visitDate || report.createdAt || report.created_at || Date.now()).toLocaleDateString()}</Text><Text style={styles.timelineTitle}>{report.title}</Text><Text style={styles.timelineMeta}>{formatCategoryLabel(String(report.category))}{report.doctorName ? ` - ${report.doctorName}` : ''}</Text>{report.hospital ? <Text style={styles.timelineHospital}>{report.hospital}</Text> : null}</View></View>)}</View>}
        </ScrollView>
      ) : workspaceTab === 'summary' ? (
        <ScrollView contentContainerStyle={styles.workspaceContent} showsVerticalScrollIndicator={false}>
          <View style={styles.workspaceHeadingRow}><View><Text style={styles.workspaceTitle}>Patient Health Summary</Text><Text style={styles.workspaceSubtitle}>Keep essential information ready for your care team.</Text></View><TouchableOpacity style={styles.editSummaryButton} onPress={openSummaryEditor}><Feather name="edit-2" size={16} color="#1A237E" /><Text style={styles.editSummaryText}>Edit</Text></TouchableOpacity></View>
          <SummaryItem icon="water-outline" label="Blood group" value={healthSummary?.bloodGroup} /><SummaryItem icon="pulse-outline" label="Known conditions" value={healthSummary?.knownConditions} /><SummaryItem icon="alert-circle-outline" label="Allergies" value={healthSummary?.allergies} /><SummaryItem icon="call-outline" label="Emergency contact" value={healthSummary?.emergencyContact} /><SummaryItem icon="document-text-outline" label="Health remarks" value={healthSummary?.healthRemarks} />
          {!healthSummary && <EmptyState icon="heart-outline" title="Summary not added" subtitle="Add your blood group, conditions, allergies, and emergency contact." />}
        </ScrollView>
      ) : null}

      {workspaceTab === 'overview' ? <>
      <View style={styles.statsRow}>
        {categoryCounts.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.statItem, activeCategory === cat.value && styles.statItemActive]}
            onPress={() => setActiveCategory(cat.value)}
            activeOpacity={0.82}
          >
            <View style={[styles.statIcon, { backgroundColor: `${categoryColor(cat.value)}18` }]}>
              <Ionicons name={categoryIcon(cat.value) as any} size={18} color={categoryColor(cat.value)} />
            </View>
            <Text style={styles.statCount}>{cat.count}</Text>
            <Text style={[styles.statLabel, activeCategory === cat.value && styles.statLabelActive]}>{cat.label.split(' ')[0]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.documentHeader}>
        <View>
          <Text style={styles.documentTitle}>Stored Documents</Text>
          <Text style={styles.documentSubtitle}>
            {activeCategory === 'all' ? 'All medical reports' : `${formatCategoryLabel(activeCategory)} records`}
          </Text>
        </View>
        <View style={styles.documentCountPill}>
          <Text style={styles.documentCountText}>{filteredReports.length} Files</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
        {categoryCounts.map((cat) => (
          <TouchableOpacity
            key={`tab-${cat.value}`}
            style={[
              styles.filterTab,
              activeCategory === cat.value && {
                backgroundColor: `${categoryColor(cat.value)}14`,
                borderColor: categoryColor(cat.value),
              },
            ]}
            onPress={() => setActiveCategory(cat.value)}
          >
            <Ionicons
              name={categoryIcon(cat.value) as any}
              size={15}
              color={activeCategory === cat.value ? categoryColor(cat.value) : '#64748B'}
            />
            <Text style={[
              styles.filterTabText,
              activeCategory === cat.value && { color: categoryColor(cat.value) },
            ]}>
              {cat.label}
            </Text>
            <View style={[styles.filterCount, activeCategory === cat.value && { backgroundColor: categoryColor(cat.value) }]}>
              <Text style={[styles.filterCountText, activeCategory === cat.value && { color: '#fff' }]}>{cat.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {fetchError ? (
        <ErrorState title="Unable to load records" subtitle={fetchError} onRetry={() => fetchReports()} />
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(true); }} colors={['#1A237E']} />}
          ListEmptyComponent={
            <EmptyState
              icon="folder-open-outline"
              title={activeCategory === 'all' ? 'No medical reports found' : `No ${formatCategoryLabel(activeCategory)} records found`}
              subtitle={activeCategory === 'all' ? 'Use the upload button to start building your health vault.' : 'Switch tabs or upload a matching record.'}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      </> : null}

      <TouchableOpacity style={[styles.uploadButton, uploading && { opacity: 0.7 }]} onPress={selectDocument} disabled={uploading}>
        <LinearGradient colors={uploading ? ['#9E9E9E', '#757575'] : ['#1A237E', '#3949AB']} style={styles.uploadButtonGradient}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload" size={22} color="#fff" />}
          <Text style={styles.uploadButtonText}>{uploading ? 'Processing...' : 'Upload Record'}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={uploadModalOpen} transparent animationType="slide" onRequestClose={() => setUploadModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.uploadModal}>
            <Text style={styles.modalTitle}>Upload Report</Text>
            <Text style={styles.modalSubtitle}>{pendingFile?.name || 'Select a medical record'}</Text>

            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Annual Checkup 2026"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.chipWrap}>
              {REPORT_CATEGORIES.map((item) => (
                <AppChip
                  key={item.value}
                  label={item.label}
                  active={category === item.value}
                  onPress={() => setCategory(item.value)}
                />
              ))}
            </View>

            <Text style={styles.inputLabel}>Privacy</Text>
            <View style={styles.privacyOptions}>
              <TouchableOpacity
                style={[styles.privacyOption, visibility === 'private' && styles.privacyOptionActive]}
                onPress={() => setVisibility('private')}
              >
                <Ionicons name="shield-checkmark" size={20} color={visibility === 'private' ? '#1A237E' : '#64748B'} />
                <Text style={styles.privacyOptionText}>Private</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.privacyOption, visibility === 'doctor' && styles.privacyOptionActive]}
                onPress={() => setVisibility('doctor')}
              >
                <Ionicons name="eye" size={20} color={visibility === 'doctor' ? '#1A237E' : '#64748B'} />
                <Text style={styles.privacyOptionText}>Visible to Doctor</Text>
              </TouchableOpacity>
            </View>

            {visibility === 'doctor' && (
              <View style={[styles.doctorShareBox, !assignedDoctor && styles.doctorShareError]}>
                <FontAwesome5 name="user-md" size={15} color={assignedDoctor ? '#2563EB' : '#DC2626'} />
                <Text style={[styles.doctorShareText, !assignedDoctor && { color: '#DC2626' }]}>
                  {assignedDoctor
                    ? `Will be shared with Dr. ${assignedDoctor.name} (${assignedDoctor.speciality || assignedDoctor.specialization || 'Doctor'})`
                    : 'No active doctor linked. Please link a doctor first.'}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <AppButton title="Cancel" variant="secondary" onPress={() => setUploadModalOpen(false)} style={styles.modalButton} />
              <AppButton title="Upload" onPress={handleUpload} loading={uploading} disabled={!pendingFile || !title.trim() || (visibility === 'doctor' && !assignedDoctor)} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={collectionModalOpen} transparent animationType="slide" onRequestClose={() => setCollectionModalOpen(false)}>
        <View style={styles.modalOverlay}><View style={styles.workspaceModal}><Text style={styles.modalTitle}>New Collection</Text><Text style={styles.inputLabel}>Name *</Text><TextInput style={styles.input} value={newCollectionName} onChangeText={setNewCollectionName} placeholder="e.g., Diabetes care" placeholderTextColor="#94A3B8" /><Text style={styles.inputLabel}>Description</Text><TextInput style={[styles.input, styles.multilineInput]} value={newCollectionDescription} onChangeText={setNewCollectionDescription} placeholder="What belongs in this collection?" placeholderTextColor="#94A3B8" multiline /><View style={styles.modalActions}><AppButton title="Cancel" variant="secondary" onPress={() => setCollectionModalOpen(false)} style={styles.modalButton} /><AppButton title="Create" onPress={createCollection} loading={savingWorkspace} disabled={!newCollectionName.trim()} style={styles.modalButton} /></View></View></View>
      </Modal>

      <Modal visible={summaryModalOpen} transparent animationType="slide" onRequestClose={() => setSummaryModalOpen(false)}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.summaryModalScroll}><View style={styles.workspaceModal}><Text style={styles.modalTitle}>Edit Health Summary</Text><SummaryInput label="Blood group" value={summaryDraft.bloodGroup || ''} onChangeText={value => setSummaryDraft(prev => ({ ...prev, bloodGroup: value }))} placeholder="e.g., O+" /><SummaryInput label="Known conditions" value={summaryDraft.knownConditions || ''} onChangeText={value => setSummaryDraft(prev => ({ ...prev, knownConditions: value }))} placeholder="e.g., Diabetes" multiline /><SummaryInput label="Allergies" value={summaryDraft.allergies || ''} onChangeText={value => setSummaryDraft(prev => ({ ...prev, allergies: value }))} placeholder="e.g., Penicillin" multiline /><SummaryInput label="Emergency contact" value={summaryDraft.emergencyContact || ''} onChangeText={value => setSummaryDraft(prev => ({ ...prev, emergencyContact: value }))} placeholder="Name and phone number" /><SummaryInput label="Health remarks" value={summaryDraft.healthRemarks || ''} onChangeText={value => setSummaryDraft(prev => ({ ...prev, healthRemarks: value }))} placeholder="Anything your care team should know" multiline /><View style={styles.modalActions}><AppButton title="Cancel" variant="secondary" onPress={() => setSummaryModalOpen(false)} style={styles.modalButton} /><AppButton title="Save" onPress={saveSummary} loading={savingWorkspace} style={styles.modalButton} /></View></View></ScrollView></View>
      </Modal>

      <Modal visible={actionMenuOpen} transparent animationType="slide" onRequestClose={() => setActionMenuOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionMenuOpen(false)}>
          <View style={styles.actionMenu}>
            <Text style={styles.actionMenuTitle}>{selectedReport?.title || selectedReport?.originalFileName || 'Report'}</Text>
            <ActionRow icon="eye" label="View document" onPress={() => { if (selectedReport) openReport(selectedReport); setActionMenuOpen(false); }} />
            <ActionRow
              icon={selectedReport?.isPinned ? "pin" : "pin-outline"}
              label={selectedReport?.isPinned ? "Unpin from top" : "Pin to top"}
              onPress={async () => {
                if (!selectedReport) return;
                try {
                  await togglePinReport(selectedReport.id);
                  setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, isPinned: !r.isPinned } : r));
                  showToast({ type: 'success', message: selectedReport.isPinned ? 'Record unpinned.' : 'Record pinned to top.' });
                } catch {
                  showToast({ type: 'error', message: 'Unable to update pin status.' });
                }
                setActionMenuOpen(false);
              }}
            />
            <ActionRow
              icon={selectedReport?.isImportant ? "star" : "star-outline"}
              label={selectedReport?.isImportant ? "Remove from starred" : "Mark as important"}
              onPress={async () => {
                if (!selectedReport) return;
                try {
                  await toggleImportantReport(selectedReport.id);
                  setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, isImportant: !r.isImportant } : r));
                  showToast({ type: 'success', message: selectedReport.isImportant ? 'Star removed.' : 'Marked as important.' });
                } catch {
                  showToast({ type: 'error', message: 'Unable to update status.' });
                }
                setActionMenuOpen(false);
              }}
            />
            <ActionRow
              icon={selectedReport?.isArchived ? "archive" : "archive-outline"}
              label={selectedReport?.isArchived ? "Restore from archive" : "Archive record"}
              onPress={async () => {
                if (!selectedReport) return;
                try {
                  await toggleArchiveReport(selectedReport.id);
                  setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, isArchived: !r.isArchived } : r));
                  showToast({ type: 'success', message: selectedReport.isArchived ? 'Restored.' : 'Archived.' });
                } catch {
                  showToast({ type: 'error', message: 'Unable to update archive.' });
                }
                setActionMenuOpen(false);
              }}
            />
            <ActionRow icon="trash" label="Delete document" danger onPress={() => selectedReport && confirmDelete(selectedReport)} />
            <TouchableOpacity style={styles.closeAction} onPress={() => setActionMenuOpen(false)}>
              <Text style={styles.closeActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity style={styles.previewHeaderButton} onPress={() => setPreviewOpen(false)}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.previewTitleContainer}>
              <Text style={styles.previewTitle} numberOfLines={1}>{selectedReport?.title || 'Report Preview'}</Text>
              <Text style={styles.previewSubtitle}>{selectedReport?.category} • {formatDate(selectedReport?.created_at || selectedReport?.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.previewContent}>
            {previewType === 'image' && (
              <ScrollView contentContainerStyle={styles.zoomContainer} maximumZoomScale={5} minimumZoomScale={1}>
                <Image source={{ uri: previewUri }} style={styles.previewImage} contentFit="contain" />
              </ScrollView>
            )}
            {previewType === 'pdf' && (
              <WebView source={{ uri: previewUri }} style={styles.previewWebView} originWhitelist={['*']} startInLoadingState />
            )}
            {previewType === 'other' && (
              <EmptyState title="Preview unavailable" subtitle="This file format cannot be previewed inline." icon="document-outline" />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ActionRow = ({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) => (
  <TouchableOpacity style={styles.actionItem} onPress={onPress}>
    <Ionicons name={icon} size={22} color={danger ? '#D32F2F' : '#1A237E'} />
    <Text style={[styles.actionItemText, danger && { color: '#D32F2F' }]}>{label}</Text>
  </TouchableOpacity>
);

const SummaryItem = ({ icon, label, value }: { icon: any; label: string; value?: string | null }) => (
  <View style={styles.summaryItem}><View style={styles.summaryIcon}><Ionicons name={icon} size={19} color="#1A237E" /></View><View style={{ flex: 1 }}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value || 'Not added yet'}</Text></View></View>
);

const SummaryInput = ({ label, value, onChangeText, placeholder, multiline }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) => (
  <View><Text style={styles.inputLabel}>{label}</Text><TextInput style={[styles.input, multiline && styles.multilineInput]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A3B8" multiline={multiline} /></View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitleBlock: { flex: 1, paddingHorizontal: 14 },
  headerEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, marginTop: 3 },
  headerRight: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  reportCount: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  workspaceTabs: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, backgroundColor: '#fff' },
  workspaceTab: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  workspaceTabActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  workspaceTabText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  workspaceTabTextActive: { color: '#fff' },
  workspaceContent: { padding: 18, paddingBottom: 110 },
  workspaceHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  workspaceTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  workspaceSubtitle: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 270 },
  addCollectionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1A237E', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 },
  addCollectionText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  collectionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 },
  collectionIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  collectionName: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  collectionDescription: { color: '#64748B', fontSize: 12, marginTop: 3 },
  collectionMeta: { color: '#1A237E', fontSize: 11, fontWeight: '900', marginTop: 7 },
  timeline: { marginTop: 18 },
  timelineRow: { flexDirection: 'row', minHeight: 94 },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1A237E', borderWidth: 3, borderColor: '#C7D2FE' },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E0E7FF', marginVertical: 3 },
  timelineCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 13, marginLeft: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  timelineDate: { color: '#1A237E', fontSize: 11, fontWeight: '900' },
  timelineTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900', marginTop: 5 },
  timelineMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  timelineHospital: { color: '#047857', fontSize: 12, fontWeight: '700', marginTop: 4 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { color: '#64748B', fontSize: 11, fontWeight: '900' },
  summaryValue: { color: '#0F172A', fontSize: 14, fontWeight: '800', marginTop: 4 },
  editSummaryButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 },
  editSummaryText: { color: '#1A237E', fontWeight: '900', fontSize: 12 },
  workspaceModal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: Platform.OS === 'ios' ? 38 : 22 },
  summaryModalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  multilineInput: { minHeight: 82, paddingTop: 14, textAlignVertical: 'top' },
  statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: -10, borderRadius: 16, padding: 12, elevation: 4 },
  statItem: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 6 },
  statItemActive: { backgroundColor: '#F8FAFC' },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statCount: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  statLabelActive: { color: '#1A237E', fontWeight: '900' },
  documentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginTop: 18, marginBottom: 10 },
  documentTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  documentSubtitle: { color: '#64748B', fontSize: 12, marginTop: 2 },
  documentCountPill: { backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  documentCountText: { color: '#1A237E', fontSize: 12, fontWeight: '900' },
  filterTabs: { paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterTabText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  filterCount: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  filterCountText: { color: '#64748B', fontSize: 11, fontWeight: '900' },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  reportCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  categoryBadge: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  reportInfo: { flex: 1 },
  recordIdTag: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  recordIdTagText: { fontSize: 10, fontWeight: '900', color: '#1A237E', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  tagChip: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagChipText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  reportTitle: { fontSize: 15, fontWeight: '800', color: '#1A237E', marginBottom: 3 },
  reportFileName: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  metaChipText: { fontSize: 12, fontWeight: '700' },
  privacyChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  doctorChip: { backgroundColor: '#EFF6FF' },
  privacyText: { color: '#64748B', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  doctorChipText: { color: '#2563EB' },
  fileTypeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  fileTypeText: { color: '#64748B', fontSize: 11, fontWeight: '900', marginLeft: 4 },
  reportFooter: { fontSize: 11, color: '#666' },
  moreButton: { padding: 8, marginLeft: 4 },
  uploadButton: { position: 'absolute', bottom: 24, left: 20, right: 20, borderRadius: 16, overflow: 'hidden', elevation: 6 },
  uploadButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  uploadModal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A237E', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  inputLabel: { color: '#64748B', fontSize: 12, fontWeight: '900', marginBottom: 6, marginTop: 10 },
  input: { minHeight: 50, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, color: '#0F172A', fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  privacyOptions: { flexDirection: 'row', gap: 10 },
  privacyOption: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 13, alignItems: 'center', backgroundColor: '#F8FAFC' },
  privacyOptionActive: { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },
  privacyOptionText: { color: '#0F172A', fontWeight: '800', fontSize: 12, marginTop: 6 },
  doctorShareBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 14, padding: 12, marginTop: 12 },
  doctorShareError: { backgroundColor: '#FEF2F2' },
  doctorShareText: { flex: 1, marginLeft: 9, color: '#2563EB', fontSize: 12, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  modalButton: { flex: 1 },
  actionMenu: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  actionMenuTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  actionItemText: { fontSize: 16, color: '#333' },
  closeAction: { marginTop: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12 },
  closeActionText: { fontSize: 16, color: '#666', fontWeight: '600' },
  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.8)' },
  previewHeaderButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  previewTitleContainer: { flex: 1, marginHorizontal: 16 },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  previewSubtitle: { color: '#ccc', fontSize: 12, marginTop: 2 },
  previewContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: 620 },
  previewWebView: { width: '100%', flex: 1, backgroundColor: '#000' },
  zoomContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
});
