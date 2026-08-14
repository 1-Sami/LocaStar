import {
  fetchHandledBusinessClaims,
  fetchHandledLocationReports,
  fetchHandledReviewReports,
  fetchOpenBusinessClaims,
  fetchProfile,
  fetchOpenLocationReports,
  fetchOpenReviewReports,
  issueWarning,
  resolveBusinessClaim,
  resolveLocationReport,
  resolveReviewReport,
  updateLocationStatus,
  updateReviewStatus,
  verifyLocationOwner,
  type BusinessClaim,
  type LocationReport,
  type ResolutionAction,
  type ReviewReport,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModerationActionModal } from '@/components/moderation-action-modal';
import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type Tab = 'locations' | 'reviews' | 'claims';

const RESOLUTION_LABEL_KEYS: Record<ResolutionAction, string> = {
  dismissed: 'admin.resolvedDismissed',
  warned: 'admin.resolvedWarned',
  hidden: 'admin.resolvedHidden',
  removed: 'admin.resolvedRemoved',
};

/**
 * What the moderator chose. Reports handled before the decision was recorded
 * have no action stored, so fall back to inferring it from the content's
 * current status — which is what the screen used to do for everything.
 */
function resolutionLabel(action: ResolutionAction | null, inferred: string, t: TFunction): string {
  return action ? t(RESOLUTION_LABEL_KEYS[action]) : inferred;
}

function inferredLocationLabel(report: LocationReport, t: TFunction): string {
  if (report.locationStatus === 'flagged') return t('admin.resolvedHidden');
  if (report.locationStatus === 'removed') return t('admin.resolvedRemoved');
  return t('admin.resolvedDismissed');
}

function inferredReviewLabel(report: ReviewReport, t: TFunction): string {
  if (report.reviewStatus === 'hidden') return t('admin.resolvedHidden');
  if (report.reviewStatus === 'removed') return t('admin.resolvedRemoved');
  return t('admin.resolvedDismissed');
}

function claimActionLabel(claim: BusinessClaim, t: TFunction): string {
  return claim.status === 'approved' ? t('admin.resolvedApproved') : t('admin.resolvedRejected');
}

/** A decision waiting on the moderator to type a reason and confirm it. */
type PendingDecision = {
  reportId: string;
  title: string;
  consequence: string;
  noteLabel: string;
  confirmLabel: string;
  destructive: boolean;
  run: (note: string) => Promise<void>;
};

export default function AdminReportsScreen() {
  const { t } = useTranslation();
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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Business claims are admin-only in RLS, so superusers must not be offered
  // that tab — they'd see an empty list and their actions would silently fail.
  const [isAdmin, setIsAdmin] = useState(false);

  const [pending, setPending] = useState<PendingDecision | null>(null);

  const runPendingDecision = async (note: string) => {
    if (!pending) return;
    setBusyId(pending.reportId);
    setActionError(null);
    try {
      await pending.run(note);
      setPending(null);
      reload();
    } catch (err) {
      // A moderation action failing quietly is the worst case here: the
      // moderator would assume it went through and move on.
      console.error('Moderation action failed', err);
      setActionError(t('admin.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const reload = useCallback(() => {
    setLoading(true);
    if (session) {
      fetchProfile(supabase, session.user.id)
        .then((profile) => setIsAdmin(profile.role === 'admin'))
        .catch(() => setIsAdmin(false));
    }
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
        setLoadFailed(false);
      })
      .catch((err) => {
        // Clearing the lists here would render as "All caught up", which is
        // indistinguishable from a genuinely empty queue. Say it failed.
        console.error('Failed to load reports', err);
        setLoadFailed(true);
      })
      .finally(() => {
        setLoading(false);
        setHasLoadedOnce(true);
      });
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  /* ---------------------------------------------------- location reports --- */

  const askDismissLocation = (report: LocationReport) =>
    setPending({
      reportId: report.id,
      title: t('admin.dismissReportTitle'),
      consequence: t('admin.dismissLocationBody', {
        location: report.locationName,
        creator: report.locationCreatorName,
      }),
      noteLabel: t('admin.whyDismissing'),
      confirmLabel: t('admin.dismissReport'),
      destructive: false,
      run: async (note) => {
        if (!session) return;
        await resolveLocationReport(supabase, report.id, 'dismissed', session.user.id, 'dismissed', note);
      },
    });

  /**
   * Warn the person behind a reported item. Bans deliberately stay on the
   * People & bans screen, where duration and reason get proper input — a
   * one-tap ban from a report card is too easy to fire by accident.
   */
  const askWarnLocationAuthor = (report: LocationReport) =>
    setPending({
      reportId: report.id,
      title: t('admin.warnPerson', { name: report.locationCreatorName }),
      consequence: t('admin.warnLocationBody', { location: report.locationName }),
      noteLabel: t('admin.warningNote'),
      confirmLabel: t('admin.sendWarning'),
      destructive: false,
      run: async (note) => {
        if (!session || !report.locationCreatorId) return;
        await issueWarning(supabase, {
          userId: report.locationCreatorId,
          issuedBy: session.user.id,
          reason: note,
          targetType: 'location',
          targetId: report.locationId,
        });
        await resolveLocationReport(supabase, report.id, 'actioned', session.user.id, 'warned', note);
      },
    });

  const askHideLocation = (report: LocationReport) =>
    setPending({
      reportId: report.id,
      title: t('admin.hideLocationTitle'),
      consequence: t('admin.hideLocationBody', { location: report.locationName }),
      noteLabel: t('admin.whyHiding'),
      confirmLabel: t('admin.hideIt'),
      destructive: false,
      run: async (note) => {
        if (!session) return;
        await updateLocationStatus(supabase, report.locationId, 'flagged');
        await resolveLocationReport(supabase, report.id, 'actioned', session.user.id, 'hidden', note);
      },
    });

  const askRemoveLocation = (report: LocationReport) =>
    setPending({
      reportId: report.id,
      title: t('admin.removeLocationTitle'),
      consequence: t('admin.removeLocationBody', { location: report.locationName }),
      noteLabel: t('admin.whyRemoving'),
      confirmLabel: t('common.remove'),
      destructive: true,
      run: async (note) => {
        if (!session) return;
        await updateLocationStatus(supabase, report.locationId, 'removed');
        await resolveLocationReport(supabase, report.id, 'actioned', session.user.id, 'removed', note);
      },
    });

  /* ------------------------------------------------------ review reports --- */

  const askDismissReview = (report: ReviewReport) =>
    setPending({
      reportId: report.id,
      title: t('admin.dismissReportTitle'),
      consequence: t('admin.dismissReviewBody', { author: report.reviewAuthorName }),
      noteLabel: t('admin.whyDismissing'),
      confirmLabel: t('admin.dismissReport'),
      destructive: false,
      run: async (note) => {
        if (!session) return;
        await resolveReviewReport(supabase, report.id, 'dismissed', session.user.id, 'dismissed', note);
      },
    });

  const askWarnReviewAuthor = (report: ReviewReport) =>
    setPending({
      reportId: report.id,
      title: t('admin.warnPerson', { name: report.reviewAuthorName }),
      consequence: t('admin.warnReviewBody', { location: report.locationName }),
      noteLabel: t('admin.warningNote'),
      confirmLabel: t('admin.sendWarning'),
      destructive: false,
      run: async (note) => {
        if (!session || !report.reviewAuthorId) return;
        await issueWarning(supabase, {
          userId: report.reviewAuthorId,
          issuedBy: session.user.id,
          reason: note,
          targetType: 'review',
          targetId: report.reviewId,
        });
        await resolveReviewReport(supabase, report.id, 'actioned', session.user.id, 'warned', note);
      },
    });

  const askHideReview = (report: ReviewReport) =>
    setPending({
      reportId: report.id,
      title: t('admin.hideReviewTitle'),
      consequence: t('admin.hideReviewBody', {
        author: report.reviewAuthorName,
        location: report.locationName,
      }),
      noteLabel: t('admin.whyHiding'),
      confirmLabel: t('admin.hideIt'),
      destructive: false,
      run: async (note) => {
        if (!session) return;
        await updateReviewStatus(supabase, report.reviewId, 'hidden');
        await resolveReviewReport(supabase, report.id, 'actioned', session.user.id, 'hidden', note);
      },
    });

  const askRemoveReview = (report: ReviewReport) =>
    setPending({
      reportId: report.id,
      title: t('admin.removeReviewTitle'),
      consequence: t('admin.removeReviewBody', {
        author: report.reviewAuthorName,
        location: report.locationName,
      }),
      noteLabel: t('admin.whyRemoving'),
      confirmLabel: t('common.remove'),
      destructive: true,
      run: async (note) => {
        if (!session) return;
        await updateReviewStatus(supabase, report.reviewId, 'removed');
        await resolveReviewReport(supabase, report.id, 'actioned', session.user.id, 'removed', note);
      },
    });

  /* ----------------------------------------------------- business claims --- */

  // Claims used to resolve straight from a plain confirm dialog, so nothing
  // recorded why a listing changed hands. They now follow the same
  // state-your-reason rule as every report action.
  const askApproveClaim = (claim: BusinessClaim) =>
    setPending({
      reportId: claim.id,
      title: t('admin.approveClaimTitle'),
      consequence: t('admin.approveClaimBody', {
        location: claim.locationName,
        claimant: claim.claimantName,
      }),
      noteLabel: t('admin.approveClaimNote'),
      confirmLabel: t('admin.approve'),
      destructive: false,
      run: async (note) => {
        await verifyLocationOwner(supabase, claim.locationId, claim.claimantId);
        await resolveBusinessClaim(supabase, claim.id, 'approved', note);
      },
    });

  const askRejectClaim = (claim: BusinessClaim) =>
    setPending({
      reportId: claim.id,
      title: t('admin.rejectClaimTitle'),
      consequence: t('admin.rejectClaimBody', {
        location: claim.locationName,
        claimant: claim.claimantName,
      }),
      noteLabel: t('admin.rejectClaimNote'),
      confirmLabel: t('admin.reject'),
      destructive: true,
      run: async (note) => {
        await resolveBusinessClaim(supabase, claim.id, 'rejected', note);
      },
    });

  // If an admin's role is revoked while the claims tab is open, fall back.
  const activeTab: Tab = tab === 'claims' && !isAdmin ? 'locations' : tab;
  const openReports =
    activeTab === 'locations' ? openLocationReports : activeTab === 'reviews' ? openReviewReports : openClaims;
  const handledReports =
    activeTab === 'locations' ? handledLocationReports : activeTab === 'reviews' ? handledReviewReports : handledClaims;

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
            <ThemedText type="smallBold">{t('admin.tabLocations', { count: openLocationReports.length })}</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'reviews' && styles.tabActive]}
            onPress={() => {
              setTab('reviews');
              setHandledExpanded(false);
            }}>
            <ThemedText type="smallBold">{t('admin.tabReviews', { count: openReviewReports.length })}</ThemedText>
          </Pressable>
          {isAdmin && (
            <Pressable
              style={[styles.tab, tab === 'claims' && styles.tabActive]}
              onPress={() => {
                setTab('claims');
                setHandledExpanded(false);
              }}>
              <ThemedText type="smallBold">{t('admin.tabClaims', { count: openClaims.length })}</ThemedText>
            </Pressable>
          )}
        </View>

        {loading && !hasLoadedOnce ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {loadFailed && (
              <ThemedView type="backgroundElement" style={styles.loadErrorCard}>
                <ThemedText type="smallBold" style={styles.loadErrorText}>
                  {t('admin.loadFailedTitle')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('admin.loadFailedBody')}
                </ThemedText>
              </ThemedView>
            )}
            {actionError && (
              <ThemedView type="backgroundElement" style={styles.loadErrorCard}>
                <ThemedText type="smallBold" style={styles.loadErrorText}>
                  {actionError}
                </ThemedText>
              </ThemedView>
            )}
            {activeTab !== 'claims' && (
              <ThemedView type="backgroundElement" style={styles.legendCard}>
                <ThemedText type="small" themeColor="textSecondary">
                  <ThemedText type="smallBold">{t('admin.legendDismiss')}</ThemedText>
                  {t('admin.legendDismissBody')}
                  {'\n'}
                  <ThemedText type="smallBold">{t('admin.legendWarn')}</ThemedText>
                  {t('admin.legendWarnBody')}
                  {'\n'}
                  {t('admin.legendReason')}
                  {'\n'}
                  <ThemedText type="smallBold">{t('admin.legendHide')}</ThemedText>
                  {t('admin.legendHideBody')}
                  {'\n'}
                  <ThemedText type="smallBold">{t('admin.legendRemove')}</ThemedText>
                  {t('admin.legendRemoveBody')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('admin.legendBans')}
                </ThemedText>
              </ThemedView>
            )}

            {openReports.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                {loadFailed ? t('admin.reportsLoadFailed') : t('admin.noOpenReports')}
              </ThemedText>
            ) : activeTab === 'locations' ? (
              openLocationReports.map((report) => {
                const busy = busyId === report.id;
                return (
                  <ThemedView key={report.id} type="backgroundElement" style={styles.card}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: report.locationId } })}>
                      <ThemedText type="smallBold">{report.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      Status: {report.locationStatus} · Added by {report.locationCreatorName} · Reported by{' '}
                      {report.reporterName} · {new Date(report.createdAt).toLocaleDateString()}
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
                        onPress={() => askDismissLocation(report)}>
                        <ThemedText type='smallBold'>{t('admin.legendDismiss')}</ThemedText>
                      </Pressable>
                      {report.locationCreatorId && (
                        <Pressable
                          style={[styles.actionButton, styles.dismissButton]}
                          disabled={busy}
                          onPress={() => askWarnLocationAuthor(report)}>
                          <ThemedText type='smallBold'>{t('admin.legendWarn')}</ThemedText>
                        </Pressable>
                      )}
                      <Pressable
                        style={[styles.actionButton, styles.flagButton]}
                        disabled={busy}
                        onPress={() => askHideLocation(report)}>
                        <ThemedText type="smallBold" style={styles.flagButtonText}>
                          {t('admin.legendHide')}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.removeButton]}
                        disabled={busy}
                        onPress={() => askRemoveLocation(report)}>
                        <ThemedText type="smallBold" style={styles.removeButtonText}>
                          {t('admin.legendRemove')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ThemedView>
                );
              })
            ) : activeTab === 'reviews' ? (
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
                        onPress={() => askDismissReview(report)}>
                        <ThemedText type='smallBold'>{t('admin.legendDismiss')}</ThemedText>
                      </Pressable>
                      {report.reviewAuthorId && (
                        <Pressable
                          style={[styles.actionButton, styles.dismissButton]}
                          disabled={busy}
                          onPress={() => askWarnReviewAuthor(report)}>
                          <ThemedText type='smallBold'>{t('admin.legendWarn')}</ThemedText>
                        </Pressable>
                      )}
                      <Pressable
                        style={[styles.actionButton, styles.flagButton]}
                        disabled={busy}
                        onPress={() => askHideReview(report)}>
                        <ThemedText type="smallBold" style={styles.flagButtonText}>
                          {t('admin.legendHide')}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.removeButton]}
                        disabled={busy}
                        onPress={() => askRemoveReview(report)}>
                        <ThemedText type="smallBold" style={styles.removeButtonText}>
                          {t('admin.legendRemove')}
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
                        style={[styles.actionButton, styles.removeButton]}
                        disabled={busy}
                        onPress={() => askRejectClaim(claim)}>
                        <ThemedText type="smallBold" style={styles.removeButtonText}>
                          {t('admin.reject')}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.flagButton]}
                        disabled={busy}
                        onPress={() => askApproveClaim(claim)}>
                        <ThemedText type="smallBold" style={styles.flagButtonText}>
                          {t('admin.approve')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ThemedView>
                );
              })
            )}

            <Pressable style={styles.handledHeader} onPress={() => setHandledExpanded((v) => !v)}>
              <ThemedText type="smallBold">{t('admin.handled', { count: handledReports.length })}</ThemedText>
              <Ionicons name={handledExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
            </Pressable>

            {handledExpanded &&
              (handledReports.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('admin.nothingHandled')}
                </ThemedText>
              ) : activeTab === 'reviews' ? (
                handledReviewReports.map((report) => (
                  <ThemedView key={report.id} type="backgroundElement" style={[styles.card, styles.handledCard]}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: report.locationId } })}>
                      <ThemedText type="smallBold">{report.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      {resolutionLabel(report.resolutionAction, inferredReviewLabel(report, t), t)} · By{' '}
                      {report.reviewAuthorName}
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
                    {report.resolutionNote && (
                      <ThemedText type="small" style={styles.resolutionNote}>
                        Moderator: &ldquo;{report.resolutionNote}&rdquo;
                      </ThemedText>
                    )}
                  </ThemedView>
                ))
              ) : activeTab === 'locations' ? (
                handledLocationReports.map((report) => (
                  <ThemedView key={report.id} type="backgroundElement" style={[styles.card, styles.handledCard]}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: report.locationId } })}>
                      <ThemedText type="smallBold">{report.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      {resolutionLabel(report.resolutionAction, inferredLocationLabel(report, t), t)} · Reported by{' '}
                      {report.reporterName} · {new Date(report.createdAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="default" style={styles.reason}>
                      {report.reason}
                    </ThemedText>
                    {report.details && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {report.details}
                      </ThemedText>
                    )}
                    {report.resolutionNote && (
                      <ThemedText type="small" style={styles.resolutionNote}>
                        Moderator: &ldquo;{report.resolutionNote}&rdquo;
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
                      {claimActionLabel(claim, t)} · Claimed by {claim.claimantName} ·{' '}
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

      <ModerationActionModal
        visible={pending !== null}
        title={pending?.title ?? ''}
        consequence={pending?.consequence ?? ''}
        noteLabel={pending?.noteLabel ?? ''}
        confirmLabel={pending?.confirmLabel ?? ''}
        destructive={pending?.destructive ?? false}
        submitting={pending !== null && busyId === pending.reportId}
        onCancel={() => setPending(null)}
        onConfirm={runPendingDecision}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
  legendCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  loadErrorCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: '#E05252',
  },
  loadErrorText: {
    color: '#E05252',
  },
  handledCard: {
    opacity: 0.85,
  },
  reason: {
    marginTop: Spacing.one,
  },
  resolutionNote: {
    marginTop: Spacing.one,
    fontStyle: 'italic',
    color: '#4CD37A',
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
