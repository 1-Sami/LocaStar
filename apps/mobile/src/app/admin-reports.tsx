import {
  fetchHandledBusinessClaims,
  fetchHandledLocationReports,
  fetchHandledReviewReports,
  fetchOpenBusinessClaims,
  fetchOpenLocationReports,
  fetchOpenReviewReports,
  resolveBusinessClaim,
  resolveLocationReport,
  resolveReviewReport,
  updateLocationStatus,
  updateReviewStatus,
  verifyLocationOwner,
  type BusinessClaim,
  type LocationReport,
  type ReviewReport,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

type Tab = 'locations' | 'reviews' | 'claims';

function locationActionLabel(report: LocationReport): string {
  if (report.locationStatus === 'flagged') return 'Flagged';
  if (report.locationStatus === 'removed') return 'Removed';
  return 'Dismissed';
}

function reviewActionLabel(report: ReviewReport): string {
  if (report.reviewStatus === 'hidden') return 'Hidden';
  if (report.reviewStatus === 'removed') return 'Removed';
  return 'Dismissed';
}

function claimActionLabel(claim: BusinessClaim): string {
  return claim.status === 'approved' ? 'Approved' : 'Rejected';
}

export default function AdminReportsScreen() {
  const { session } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('locations');
  const [handledExpanded, setHandledExpanded] = useState(false);

  const [openLocationReports, setOpenLocationReports] = useState<LocationReport[]>([]);
  const [handledLocationReports, setHandledLocationReports] = useState<LocationReport[]>([]);
  const [openReviewReports, setOpenReviewReports] = useState<ReviewReport[]>([]);
  const [handledReviewReports, setHandledReviewReports] = useState<ReviewReport[]>([]);
  const [openClaims, setOpenClaims] = useState<BusinessClaim[]>([]);
  const [handledClaims, setHandledClaims] = useState<BusinessClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchOpenLocationReports(supabase),
      fetchHandledLocationReports(supabase),
      fetchOpenReviewReports(supabase),
      fetchHandledReviewReports(supabase),
      fetchOpenBusinessClaims(supabase),
      fetchHandledBusinessClaims(supabase),
    ])
      .then(([openLocations, handledLocations, openReviews, handledReviews, openClaimsResult, handledClaimsResult]) => {
        setOpenLocationReports(openLocations);
        setHandledLocationReports(handledLocations);
        setOpenReviewReports(openReviews);
        setHandledReviewReports(handledReviews);
        setOpenClaims(openClaimsResult);
        setHandledClaims(handledClaimsResult);
      })
      .catch(() => {
        setOpenLocationReports([]);
        setHandledLocationReports([]);
        setOpenReviewReports([]);
        setHandledReviewReports([]);
        setOpenClaims([]);
        setHandledClaims([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleDismissLocation = async (report: LocationReport) => {
    if (!session) return;
    setBusyId(report.id);
    try {
      await resolveLocationReport(supabase, report.id, 'dismissed', session.user.id);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleFlagLocation = async (report: LocationReport) => {
    if (!session) return;
    setBusyId(report.id);
    try {
      await updateLocationStatus(supabase, report.locationId, 'flagged');
      await resolveLocationReport(supabase, report.id, 'actioned', session.user.id);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveLocation = async (report: LocationReport) => {
    if (!session) return;
    setBusyId(report.id);
    try {
      await updateLocationStatus(supabase, report.locationId, 'removed');
      await resolveLocationReport(supabase, report.id, 'actioned', session.user.id);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleDismissReview = async (report: ReviewReport) => {
    if (!session) return;
    setBusyId(report.id);
    try {
      await resolveReviewReport(supabase, report.id, 'dismissed', session.user.id);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleHideReview = async (report: ReviewReport) => {
    if (!session) return;
    setBusyId(report.id);
    try {
      await updateReviewStatus(supabase, report.reviewId, 'hidden');
      await resolveReviewReport(supabase, report.id, 'actioned', session.user.id);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveReview = async (report: ReviewReport) => {
    if (!session) return;
    setBusyId(report.id);
    try {
      await updateReviewStatus(supabase, report.reviewId, 'removed');
      await resolveReviewReport(supabase, report.id, 'actioned', session.user.id);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveClaim = async (claim: BusinessClaim) => {
    const confirmed = await confirmAsync(
      'Approve this claim?',
      `"${claim.locationName}" will be marked as verified and owned by ${claim.claimantName}.`,
      'Approve'
    );
    if (!confirmed) return;
    setBusyId(claim.id);
    try {
      await verifyLocationOwner(supabase, claim.locationId, claim.claimantId);
      await resolveBusinessClaim(supabase, claim.id, 'approved');
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectClaim = async (claim: BusinessClaim) => {
    const confirmed = await confirmAsync(
      'Reject this claim?',
      `The claim on "${claim.locationName}" by ${claim.claimantName} will be rejected.`,
      'Reject'
    );
    if (!confirmed) return;
    setBusyId(claim.id);
    try {
      await resolveBusinessClaim(supabase, claim.id, 'rejected');
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const openReports =
    tab === 'locations' ? openLocationReports : tab === 'reviews' ? openReviewReports : openClaims;
  const handledReports =
    tab === 'locations' ? handledLocationReports : tab === 'reviews' ? handledReviewReports : handledClaims;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, tab === 'locations' && styles.tabActive]}
            onPress={() => {
              setTab('locations');
              setHandledExpanded(false);
            }}>
            <ThemedText type="smallBold">Locations ({openLocationReports.length})</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'reviews' && styles.tabActive]}
            onPress={() => {
              setTab('reviews');
              setHandledExpanded(false);
            }}>
            <ThemedText type="smallBold">Reviews ({openReviewReports.length})</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'claims' && styles.tabActive]}
            onPress={() => {
              setTab('claims');
              setHandledExpanded(false);
            }}>
            <ThemedText type="smallBold">Claims ({openClaims.length})</ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {openReports.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                No open reports. All caught up.
              </ThemedText>
            ) : tab === 'locations' ? (
              openLocationReports.map((report) => {
                const busy = busyId === report.id;
                return (
                  <ThemedView key={report.id} type="backgroundElement" style={styles.card}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: report.locationId } })}>
                      <ThemedText type="smallBold">{report.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      Status: {report.locationStatus} · Reported by {report.reporterName} ·{' '}
                      {new Date(report.createdAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="default" style={styles.reason}>
                      {report.reason}
                    </ThemedText>
                    {report.details && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {report.details}
                      </ThemedText>
                    )}

                    <View style={styles.actionsRow}>
                      <Pressable
                        style={[styles.actionButton, styles.dismissButton]}
                        disabled={busy}
                        onPress={() => handleDismissLocation(report)}>
                        <ThemedText type="smallBold">Dismiss</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.flagButton]}
                        disabled={busy}
                        onPress={() => handleFlagLocation(report)}>
                        <ThemedText type="smallBold" style={styles.flagButtonText}>
                          Flag
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.removeButton]}
                        disabled={busy}
                        onPress={() => handleRemoveLocation(report)}>
                        <ThemedText type="smallBold" style={styles.removeButtonText}>
                          Remove
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ThemedView>
                );
              })
            ) : tab === 'reviews' ? (
              openReviewReports.map((report) => {
                const busy = busyId === report.id;
                return (
                  <ThemedView key={report.id} type="backgroundElement" style={styles.card}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: report.locationId } })}>
                      <ThemedText type="smallBold">{report.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      Review status: {report.reviewStatus} · By {report.reviewAuthorName}
                    </ThemedText>
                    <StarRating rating={report.reviewRating} size={14} />
                    {report.reviewTitle && <ThemedText type="smallBold">{report.reviewTitle}</ThemedText>}
                    {report.reviewBody && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {report.reviewBody}
                      </ThemedText>
                    )}

                    <ThemedText type="small" themeColor="textSecondary" style={styles.reason}>
                      Reported by {report.reporterName} · {new Date(report.createdAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="default">{report.reason}</ThemedText>
                    {report.details && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {report.details}
                      </ThemedText>
                    )}

                    <View style={styles.actionsRow}>
                      <Pressable
                        style={[styles.actionButton, styles.dismissButton]}
                        disabled={busy}
                        onPress={() => handleDismissReview(report)}>
                        <ThemedText type="smallBold">Dismiss</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.flagButton]}
                        disabled={busy}
                        onPress={() => handleHideReview(report)}>
                        <ThemedText type="smallBold" style={styles.flagButtonText}>
                          Hide
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.removeButton]}
                        disabled={busy}
                        onPress={() => handleRemoveReview(report)}>
                        <ThemedText type="smallBold" style={styles.removeButtonText}>
                          Remove
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ThemedView>
                );
              })
            ) : (
              openClaims.map((claim) => {
                const busy = busyId === claim.id;
                return (
                  <ThemedView key={claim.id} type="backgroundElement" style={styles.card}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: claim.locationId } })}>
                      <ThemedText type="smallBold">{claim.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      Claimed by {claim.claimantName} · {new Date(claim.createdAt).toLocaleDateString()}
                    </ThemedText>
                    {claim.verificationNotes && (
                      <ThemedText type="default" style={styles.reason}>
                        {claim.verificationNotes}
                      </ThemedText>
                    )}

                    <View style={styles.actionsRow}>
                      <Pressable
                        style={[styles.actionButton, styles.claimActionButton, styles.removeButton]}
                        disabled={busy}
                        onPress={() => handleRejectClaim(claim)}>
                        <ThemedText type="small" style={styles.removeButtonText}>
                          Reject
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.claimActionButton, styles.flagButton]}
                        disabled={busy}
                        onPress={() => handleApproveClaim(claim)}>
                        <ThemedText type="small" style={styles.flagButtonText}>
                          Approve
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ThemedView>
                );
              })
            )}

            <Pressable style={styles.handledHeader} onPress={() => setHandledExpanded((v) => !v)}>
              <ThemedText type="smallBold">Handled ({handledReports.length})</ThemedText>
              <Ionicons name={handledExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
            </Pressable>

            {handledExpanded &&
              (handledReports.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Nothing handled yet.
                </ThemedText>
              ) : tab === 'reviews' ? (
                handledReviewReports.map((report) => (
                  <ThemedView key={report.id} type="backgroundElement" style={[styles.card, styles.handledCard]}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: report.locationId } })}>
                      <ThemedText type="smallBold">{report.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      {reviewActionLabel(report)} · By {report.reviewAuthorName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Reported by {report.reporterName} · {new Date(report.createdAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="default">{report.reason}</ThemedText>
                    {report.details && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {report.details}
                      </ThemedText>
                    )}
                  </ThemedView>
                ))
              ) : tab === 'locations' ? (
                handledLocationReports.map((report) => (
                  <ThemedView key={report.id} type="backgroundElement" style={[styles.card, styles.handledCard]}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: report.locationId } })}>
                      <ThemedText type="smallBold">{report.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      {locationActionLabel(report)} · Reported by {report.reporterName} ·{' '}
                      {new Date(report.createdAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="default" style={styles.reason}>
                      {report.reason}
                    </ThemedText>
                    {report.details && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {report.details}
                      </ThemedText>
                    )}
                  </ThemedView>
                ))
              ) : (
                handledClaims.map((claim) => (
                  <ThemedView key={claim.id} type="backgroundElement" style={[styles.card, styles.handledCard]}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: claim.locationId } })}>
                      <ThemedText type="smallBold">{claim.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      {claimActionLabel(claim)} · Claimed by {claim.claimantName} ·{' '}
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </ThemedText>
                    {claim.verificationNotes && (
                      <ThemedText type="default" style={styles.reason}>
                        {claim.verificationNotes}
                      </ThemedText>
                    )}
                  </ThemedView>
                ))
              ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  tabActive: {
    backgroundColor: 'rgba(20,116,122,0.3)',
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  handledCard: {
    opacity: 0.85,
  },
  reason: {
    marginTop: Spacing.one,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  actionButton: {
    flex: 1,
    height: 40,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  claimActionButton: {
    flex: 0,
    height: 20,
    paddingHorizontal: Spacing.two,
  },
  flagButton: {
    backgroundColor: '#E8A93B',
  },
  flagButtonText: {
    color: '#1A1400',
  },
  removeButton: {
    backgroundColor: '#E05252',
  },
  removeButtonText: {
    color: '#ffffff',
  },
  handledHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.3)',
    marginTop: Spacing.two,
  },
});
