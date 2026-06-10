import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
  StyleSheet,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  Share,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons, MaterialIcons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import API from '../apiClient';
import { getCurrentProfile } from '../services/medirakshaApi';

// ============================================
// SCHEMA TYPES - Matching Backend Schema
// ============================================

const REPORT_CATEGORIES = ['Lab', 'Scan', 'Prescription', 'Discharge'] as const;
const UPLOADED_BY_OPTIONS = ['Patient', 'Doctor'] as const;

type ReportCategory = typeof REPORT_CATEGORIES[number];
type UploadedBy = typeof UPLOADED_BY_OPTIONS[number];

type MedicalReport = {
  _id: string;
  reportId: string;
  patientId: string;
  title: string;
  category: string;
  fileSize: number;
  fileId: string;
  visibility: string;
  originalFileName: string;
  mimeType: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
};

// ============================================
// MAIN COMPONENT
// ============================================

// TODO:
// - [x] Align mobile report endpoints with the PostgreSQL backend (/api/user/report/...)
// - [x] Fix In-App Document Preview (Auth & Rendering issues)
export default function MedicalReportsScreen() {
  const router = useRouter();

  // State
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Upload flow state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('Lab');
  const [pendingFile, setPendingFile] = useState<any>(null);

  // Report actions state
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);

  // AI Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    initializeUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchReports();
    }
  }, [userId]);

  const initializeUser = async () => {
    try {
      console.log('--- Initializing User in MedicalReportsScreen...');
      const storedToken = await SecureStore.getItemAsync('userToken');
      setToken(storedToken);

      const profile = await getCurrentProfile('Patient');
      console.log('--- User Profile Loaded:', profile.id);
      setUserId(profile.id);
    } catch (error: any) {
      console.error('❌ Auth error in YourReports:', error.response?.status || error.message);
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        router.replace('/Login');
      }
    }
  };

  // ============================================
  // FETCH REPORTS
  // ============================================

  const fetchReports = useCallback(async (isRefresh = false) => {
    if (!userId) return;

    try {
      if (!isRefresh) setLoading(true);

      const response = await API.get('/user/report/all');
      const rows = response.data?.data ?? [];
      setReports(Array.isArray(rows) ? rows.map((report: any) => ({
        ...report,
        _id: String(report.id),
        reportId: String(report.id),
        patientId: String(report.userId),
        createdAt: report.created_at,
        updatedAt: report.updated_at,
      })) : []);

    } catch (error: any) {
      console.error('❌ Fetch error:', error);
      if (!isRefresh) {
        Alert.alert(
          'Unable to Load Reports',
          'Please check your connection and try again.'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports(true);
  };

  // ============================================
  // UPLOAD REPORT
  // ============================================

  const selectDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      // Validate file size (max 10MB)
      const fileSizeMB = Math.ceil((file.size || 0) / (1024 * 1024));
      if (fileSizeMB > 5) {
        Alert.alert(
          'File Too Large',
          'Please select a file smaller than 5MB'
        );
        return;
      }

      // Store file and show category picker
      setPendingFile(file);
      setShowCategoryPicker(true);

    } catch (error) {
      console.error('❌ Document picker error:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const uploadReport = async () => {
    if (!pendingFile || !userId) return;

    setShowCategoryPicker(false);
    setUploading(true);

    try {
      const file = pendingFile;

      // Calculate filesize in MB (clamped to 1-10 as per schema)
      const fileSizeBytes = file.size || 1024;
      const fileSizeMB = Math.max(1, Math.min(10, Math.ceil(fileSizeBytes / (1024 * 1024))));

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
        name: file.name || `report_${Date.now()}.pdf`,
        type: file.mimeType || 'application/pdf',
      } as any);
      formData.append('title', file.name?.replace(/\.[^/.]+$/, '') || 'Medical Report');
      formData.append('category', selectedCategory === 'Discharge' ? 'other' : selectedCategory.toLowerCase());
      formData.append('visibility', 'private');

      await API.post('/user/report/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert(
        'Upload Successful! 🎉',
        `Your ${selectedCategory} report has been saved.`
      );

      fetchReports();

    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      Alert.alert(
        'Upload Failed',
        error.response?.data?.message || error.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  };

  // ============================================
  // REPORT ACTIONS
  // ============================================

  /* 👁 Open report */
  const openReport = async (report: MedicalReport) => {
    try {
      setLoading(true);
      setSelectedReport(report);

      const response = await API.get(`/user/report/${report._id}`);
      const fullReport = response.data?.data;
      if (!fullReport?.fileData) {
        throw new Error('Report file data was not returned by the server.');
      }
      const dataUri = `data:${fullReport.mimeType || report.mimeType || 'application/octet-stream'};base64,${fullReport.fileData}`;
        const rawMime = report.mimeType || (report.originalFileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const isImage = rawMime.startsWith('image/');
        const isPdf = rawMime === 'application/pdf';

        if (isImage) {
          setPreviewImage(dataUri);
          setPreviewPdf(null);
        } else if (isPdf) {
          setPreviewPdf(dataUri);
          setPreviewImage(null);
        }
        setShowPreviewModal(true);
        setLoading(false);

    } catch (error: any) {
      console.error('❌ Open error:', error);
      Alert.alert('Error', 'Failed to load report. Please try again.');
      setLoading(false);
    }
  };

  const downloadReport = async (report: MedicalReport) => {
    try {
      await openReport(report);
    } catch (e) {
      Alert.alert('Error', 'Failed to retrieve auth token');
    }
  };

  const shareReport = async (report: MedicalReport) => {
    try {
      await Share.share({
        message: `Medical Report: ${report.originalFileName || report.title || 'Report'}`,
        title: report.originalFileName || report.title || 'Medical Report',
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to share report');
    }
    setShowActionMenu(false);
  };

  const toggleDoctorSharing = async (report: MedicalReport) => {
    const visibility = report.visibility === 'shared' ? 'private' : 'shared';
    try {
      await API.patch(`/user/report/${report._id}/visibility`, { visibility });
      setReports(prev => prev.map(item => item._id === report._id ? { ...item, visibility } : item));
      setSelectedReport(prev => prev?._id === report._id ? { ...prev, visibility } : prev);
      setShowActionMenu(false);
      Alert.alert('Sharing Updated', visibility === 'shared' ? 'Your doctors can now access this report.' : 'This report is private again.');
    } catch (error: any) {
      Alert.alert('Unable to Update Sharing', error.response?.data?.detail || 'Please try again.');
    }
  };

  const deleteReport = (report: MedicalReport) => {
    Alert.alert(
      'Delete Report',
      `Are you sure you want to delete "${report.originalFileName || report.title || 'this report'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.delete(`/user/report/${report._id}`);
              Alert.alert('Deleted', 'Report has been removed');
              fetchReports();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete report');
            }
          },
        },
      ]
    );
    setShowActionMenu(false);
  };

  const analyzeReport = async (report: MedicalReport) => {
    setShowActionMenu(false);
    setAnalyzing(true);
    setShowAnalysisModal(true);

    try {
      const response = await API.post('/analyze-report', { fileId: report._id });
      setAnalysisResult(response.data);
    } catch (error: any) {
      Alert.alert('Analysis Error', error.response?.data?.message || error.message || 'AI Analysis failed.');
      setShowAnalysisModal(false);
    } finally {
      setAnalyzing(false);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCategoryIcon = (category: ReportCategory) => {
    const icons: Record<ReportCategory, string> = {
      Lab: 'flask',
      Scan: 'scan-outline',
      Prescription: 'document-text',
      Discharge: 'exit-outline',
    };
    return icons[category] || 'document';
  };

  const getCategoryColor = (category: ReportCategory) => {
    const colors: Record<ReportCategory, string> = {
      Lab: '#4CAF50',
      Scan: '#2196F3',
      Prescription: '#FF9800',
      Discharge: '#9C27B0',
    };
    return colors[category] || '#666';
  };

  // ============================================
  // RENDER COMPONENTS
  // ============================================

  const renderReportCard = ({ item }: { item: MedicalReport }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => openReport(item)}
      onLongPress={() => {
        setSelectedReport(item);
        setShowActionMenu(true);
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category as any) + '20' }]}>
        <Ionicons
          name={getCategoryIcon(item.category as any) as any}
          size={24}
          color={getCategoryColor(item.category as any)}
        />
      </View>

      <View style={styles.reportInfo}>
        <Text style={styles.reportTitle} numberOfLines={2}>
          {item.originalFileName || item.title || 'Medical Report'}
        </Text>

        <View style={styles.reportMeta}>
          <View style={styles.metaChip}>
            <Text style={[styles.metaChipText, { color: getCategoryColor(item.category as any) }]}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Text>
          </View>

          <Text style={styles.reportDate}>
            {formatDate(item.createdAt)}
          </Text>
        </View>

        <View style={styles.reportFooter}>
          <Text style={styles.fileSizeText}>
            {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
          </Text>
          <Text style={styles.uploadedByText}>
            From: {item.uploadedBy || 'Patient'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.moreButton}
        onPress={() => {
          setSelectedReport(item);
          setShowActionMenu(true);
        }}
      >
        <Feather name="more-vertical" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name="folder-open" size={64} color="#ccc" />
      </View>
      <Text style={styles.emptyTitle}>No Reports Yet</Text>
      <Text style={styles.emptySubtitle}>
        Upload your medical reports to keep them{'\n'}organized and accessible anytime
      </Text>
    </View>
  );

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
        <Text style={styles.loadingText}>Loading your reports...</Text>
      </View>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1A237E', '#3949AB']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medical Reports</Text>
        <View style={styles.headerRight}>
          <Text style={styles.reportCount}>{reports.length}</Text>
        </View>
      </LinearGradient>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {REPORT_CATEGORIES.map((cat) => {
          const safeReports = Array.isArray(reports) ? reports : [];
          const count = safeReports.filter(r => r.category?.toLowerCase() === cat.toLowerCase()).length;
          return (
            <View key={cat} style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: getCategoryColor(cat) + '20' }]}>
                <Ionicons
                  name={getCategoryIcon(cat) as any}
                  size={18}
                  color={getCategoryColor(cat)}
                />
              </View>
              <Text style={styles.statCount}>{count}</Text>
              <Text style={styles.statLabel}>{cat}</Text>
            </View>
          );
        })}
      </View>

      {/* Reports List */}
      <FlatList
        data={reports}
        keyExtractor={(item) => item._id}
        renderItem={renderReportCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1A237E']} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
        onPress={selectDocument}
        disabled={uploading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={uploading ? ['#9E9E9E', '#757575'] : ['#1A237E', '#3949AB']}
          style={styles.uploadButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {uploading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.uploadButtonText}>Uploading...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={22} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload Report</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <Text style={styles.modalTitle}>Select Report Type</Text>
            <Text style={styles.modalSubtitle}>
              Choose the category for: {pendingFile?.name}
            </Text>

            <View style={styles.categoryGrid}>
              {REPORT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    selectedCategory === cat && styles.categoryOptionSelected,
                    { borderColor: getCategoryColor(cat) }
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <View style={[styles.categoryIconBox, { backgroundColor: getCategoryColor(cat) + '20' }]}>
                    <Ionicons
                      name={getCategoryIcon(cat) as any}
                      size={28}
                      color={getCategoryColor(cat)}
                    />
                  </View>
                  <Text style={[
                    styles.categoryOptionText,
                    selectedCategory === cat && { color: getCategoryColor(cat), fontWeight: 'bold' }
                  ]}>
                    {cat}
                  </Text>
                  {selectedCategory === cat && (
                    <Ionicons name="checkmark-circle" size={20} color={getCategoryColor(cat)} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCategoryPicker(false);
                  setPendingFile(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: getCategoryColor(selectedCategory) }]}
                onPress={uploadReport}
              >
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={styles.confirmButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action Menu Modal */}
      <Modal
        visible={showActionMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionMenu(false)}
        >
          <View style={styles.actionMenu}>
            <Text style={styles.actionMenuTitle}>{selectedReport?.originalFileName || selectedReport?.title || 'Report'}</Text>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (selectedReport) openReport(selectedReport);
                setShowActionMenu(false);
              }}
            >
              <Ionicons name="eye" size={22} color="#1A237E" />
              <Text style={styles.actionItemText}>View Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.aiActionItem]}
              onPress={() => selectedReport && analyzeReport(selectedReport)}
            >
              <FontAwesome5 name="robot" size={18} color="#1A237E" />
              <Text style={[styles.actionItemText, { fontWeight: 'bold' }]}>AI Analysis</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (selectedReport) downloadReport(selectedReport);
                setShowActionMenu(false);
              }}
            >
              <Ionicons name="download" size={22} color="#1A237E" />
              <Text style={styles.actionItemText}>Download</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => selectedReport && toggleDoctorSharing(selectedReport)}
            >
              <Ionicons name={selectedReport?.visibility === 'shared' ? 'lock-closed' : 'people'} size={22} color="#1A237E" />
              <Text style={styles.actionItemText}>{selectedReport?.visibility === 'shared' ? 'Make Private' : 'Share with Doctors'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.deleteAction]}
              onPress={() => selectedReport && deleteReport(selectedReport)}
            >
              <Ionicons name="trash" size={22} color="#D32F2F" />
              <Text style={[styles.actionItemText, { color: '#D32F2F' }]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeAction}
              onPress={() => setShowActionMenu(false)}
            >
              <Text style={styles.closeActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* AI Analysis Modal */}
      <Modal
        visible={showAnalysisModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnalysisModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.analysisModal}>
            <View style={styles.analysisHeader}>
              <FontAwesome5 name="robot" size={24} color="#1A237E" />
              <Text style={styles.analysisTitle}>AI Report Analysis</Text>
              <TouchableOpacity onPress={() => setShowAnalysisModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {analyzing ? (
              <View style={styles.analysisLoading}>
                <ActivityIndicator size="large" color="#1A237E" />
                <Text style={styles.analysisLoadingText}>
                  Analyzing your medical report...
                </Text>
              </View>
            ) : analysisResult ? (
              <ScrollView style={styles.analysisContent}>
                {analysisResult.history && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.sectionTitle}>Medical History</Text>
                    <Text style={styles.sectionText}>{analysisResult.history}</Text>
                  </View>
                )}

                {analysisResult.mandatory_care?.length > 0 && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.sectionTitle}>Care Instructions</Text>
                    {analysisResult.mandatory_care.map((item: string, idx: number) => (
                      <View key={idx} style={styles.careItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={styles.careText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.disclaimer}>
                  <Ionicons name="information-circle" size={16} color="#666" />
                  <Text style={styles.disclaimerText}>
                    This AI analysis is for informational purposes only and should not replace professional medical advice.
                  </Text>
                </View>
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={styles.closeAnalysisButton}
              onPress={() => setShowAnalysisModal(false)}
            >
              <Text style={styles.closeAnalysisText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* =======================
          IMAGE PREVIEW MODAL
          ======================= */}
      <Modal
        visible={showPreviewModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.previewContainer}>
          {/* Header */}
          <View style={styles.previewHeader}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setShowPreviewModal(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.previewTitleContainer}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedReport?.title || 'Report Preview'}
              </Text>
              <Text style={styles.previewSubtitle}>
                {selectedReport?.category} • {new Date(selectedReport?.createdAt || '').toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => {
                if (selectedReport) shareReport(selectedReport);
              }}
            >
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewCloseButton, { marginLeft: 8 }]}
              onPress={() => {
                if (selectedReport) downloadReport(selectedReport);
              }}
            >
              <Ionicons name="download-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewCloseButton, { marginLeft: 8 }]}
              onPress={() => {
                Alert.alert('Not Available', 'The referenced backend returns reports from the database, not a public browser URL.');
              }}
            >
              <Ionicons name="globe-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.previewContent}>
            {previewImage && (
              <ScrollView
                maximumZoomScale={5}
                minimumZoomScale={1}
                pinchGestureEnabled={true}
                centerContent={true}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.zoomContainer}
              >
                <Image
                  source={{ uri: previewImage }}
                  style={styles.previewImage}
                  contentFit="contain"
                />
              </ScrollView>
            )}
            {previewPdf && (
              <WebView
                source={{ uri: previewPdf }}
                style={styles.previewWebView}
                scalesPageToFit={true}
                originWhitelist={['*']}
                domStorageEnabled={true}
                javaScriptEnabled={true}
                startInLoadingState={true}
                allowFileAccess={true}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                builtInZoomControls={true}
                displayZoomControls={false}
                renderLoading={() => (
                  <View style={styles.webViewLoader}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Opening Document...</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportCount: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 100,
  },

  // Report Card
  reportCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  categoryBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A237E',
    marginBottom: 8,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaChip: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportDate: {
    fontSize: 12,
    color: '#888',
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileSizeText: {
    fontSize: 11,
    color: '#666',
    marginRight: 12,
  },
  uploadedByText: {
    fontSize: 11,
    color: '#888',
  },
  moreButton: {
    padding: 8,
    marginLeft: 4,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Upload Button
  uploadButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#1A237E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  // Category Modal
  categoryModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A237E',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  categoryGrid: {
    gap: 12,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    backgroundColor: '#fff',
    borderWidth: 2,
  },
  categoryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  categoryOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },

  // Action Menu
  actionMenu: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  actionMenuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  aiActionItem: {
    backgroundColor: '#E8EAF6',
    borderRadius: 12,
    marginVertical: 4,
  },
  actionItemText: {
    fontSize: 16,
    color: '#333',
  },
  deleteAction: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 8,
  },
  closeAction: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  closeActionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },

  // Analysis Modal
  analysisModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A237E',
    flex: 1,
    marginLeft: 12,
  },
  analysisLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  analysisLoadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#666',
  },
  analysisContent: {
    maxHeight: 400,
  },
  analysisSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  careItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  careText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  disclaimer: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginTop: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  closeAnalysisButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#1A237E',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeAnalysisText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Image Preview Styles
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  previewCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTitleContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewSubtitle: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  previewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.7,
  },
  previewWebView: {
    width: Dimensions.get('window').width,
    flex: 1,
    backgroundColor: '#000',
  },
  zoomContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
