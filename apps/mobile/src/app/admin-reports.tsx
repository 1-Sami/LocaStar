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
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModerationActionModal } from '@/components/moderation-action-modal';
import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

type Tab = 'locations' | 'reviews' | 'claims';

const RESOLUTION_LABELS: Record<ResolutionAction, string> = {
  dismissed: 'Dismissed',
  warned: 'Warned the author',
  hidden: 'Hidden',
  removed: 'Removed',
};

/**
 * What the moderator chose. Reports handled before the decision was recorded
 * have no action stored, so fall back to inferring it from the content's
 * current status — which is what the screen used to do for everything.
 */
function resolutionLabel(action: ResolutionAction | null, inferred: string): string {
  return action ? RESOLUTION_LABELS[action] : inferred;
}

function inferredLocationLabel(report: LocationReport): string {
  if (report.locationStatus === 'flagged') return 'Hidden';
  if (report.locationStatus === 'removed') return 'Removed';
  return 'Dismissed';
}

function inferredReviewLabel(report: ReviewReport): string {
  if (report.reviewStatus === 'hidden') return 'Hidden';
  if (report.reviewStatus === 'removed') return 'Removed';
  return 'Dismissed';
}

function claimActionLabel(claim: BusinessClaim): string {
  return claim.status === 'approved' ? 'Approved' : 'Rejected';
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
      setActionError("That didn't go through. Nothing was changed — try again.");
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
      title: 'Dismiss this report?',
      consequence: `The report is closed and "${report.locationName}" stays visible to everyone. ${report.locationCreatorName} is not told anything.`,
      noteLabel: 'Why are you dismissing it?',
      confirmLabel: 'Dismiss report',
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
      title: `Warn ${report.locationCreatorName}?`,
      consequence: `They added "${report.locationName}". They'll see your reason on their profile. The location stays visible — hide or remove it separately if it should come down.`,
      noteLabel: 'What should they be told? (they will read this)',
      confirmLabel: 'Send warning',
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
      title: 'Hide this location?',
      consequence: `"${report.locationName}" disappears from search, the map and everyone's lists, but is not deleted — you can restore it later. Use this when you're not sure yet.`,
      noteLabel: 'Why are you hiding it?',
      confirmLabel: 'Hide it',
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
      title: 'Remove this location?',
      consequence: `"${report.locationName}" is taken down for everyone, along with its reviews and photos. Use this when the place is fake, unlawful or clearly wrong.`,
      noteLabel: 'Why are you removing it?',
      confirmLabel: 'Remove',
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
      title: 'Dismiss this report?',
      consequence: `The report is closed and the review by ${report.reviewAuthorName} stays visible. They are not told anything.`,
      noteLabel: 'Why are you dismissing it?',
      confirmLabel: 'Dismiss report',
      destructive: false,
      run: async (note) => {
        if (!session) return;
        await resolveReviewReport(supabase, report.id, 'dismissed', session.user.id, 'dismissed', note);
      },
    });

  const askWarnReviewAuthor = (report: ReviewReport) =>
    setPending({
      reportId: report.id,
      title: `Warn ${report.reviewAuthorName}?`,
      consequence: `They wrote the reported review on "${report.locationName}". They'll see your reason on their profile. The review stays visible — hide or remove it separately if it should come down.`,
      noteLabel: 'What should they be told? (they will read this)',
      confirmLabel: 'Send warning',
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
      title: 'Hide this review?',
      consequence: `The review by ${report.reviewAuthorName} disappears from "${report.locationName}" and stops counting toward its rating. It is not deleted — you can restore it later.`,
      noteLabel: 'Why are you hiding it?',
      confirmLabel: 'Hide it',
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
      title: 'Remove this review?',
      consequence: `The review by ${report.reviewAuthorName} is taken down for good and stops counting toward the rating of "${report.locationName}".`,
      noteLabel: 'Why are you removing it?',
      confirmLabel: 'Remove',
      destructive: true,
      run: async (note) => {
        if (!session) return;
        await updateReviewStatus(supabase, report.reviewId, 'removed');
        await resolveReviewReport(supabase, report.id, 'actioned', session.user.id, 'removed', note);
      },
    });

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
          {isAdmin && (
            <Pressable
              style={[styles.tab, tab === 'claims' && styles.tabActive]}
              onPress={() => {
                setTab('claims');
                setHandledExpanded(false);
              }}>
              <ThemedText type="smallBold">Claims ({openClaims.length})</ThemedText>
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
                  Couldn&apos;t load reports
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  This list may be out of date or incomplete. Pull back and reopen the page to try again.
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
                  <ThemedText type="smallBold">Dismiss</ThemedText> — close the report, change nothing.{'\n'}
                  <ThemedText type="smallBold">Warn</ThemedText> — message the person who posted it; the
                  content stays up.{'\n'}
                  Every action asks you for a reason, which is saved to the moderation log.{'\n'}
                  <ThemedText type="smallBold">Hide</ThemedText> — take it out of the app but keep it, so
                  you can restore it.{'\n'}
                  <ThemedText type="smallBold">Remove</ThemedText> — take it down for good.
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  To restrict the person themselves, use People &amp; bans.
                </ThemedText>
              </ThemedView>
            )}

            {openReports.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                {loadFailed ? 'Reports could not be loaded.' : 'No open reports. All caught up.'}
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
                        <ThemedText type="smallBold">Dismiss</ThemedText>
                      </Pressable>
                      {report.locationCreatorId && (
                        <Pressable
                          style={[styles.actionButton, styles.dismissButton]}
                          disabled={busy}
                          onPress={() => askWarnLocationAuthor(report)}>
                          <ThemedText type="smallBold">Warn</ThemedText>
                        </Pressable>
                      )}
                      <Pressable
                        style={[styles.actionButton, styles.flagButton]}
                        disabled={busy}
                        onPress={() => askHideLocation(report)}>
                        <ThemedText type="smallBold" style={styles.flagButtonText}>
                          Hide
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.removeButton]}
                        disabled={busy}
                        onPress={() => askRemoveLocation(report)}>
                        <ThemedText type="smallBold" style={styles.removeButtonText}>
                          Remove
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
                        <ThemedText type="smallBold">Dismiss</ThemedText>
                      </Pressable>
                      {report.reviewAuthorId && (
                        <Pressable
                          style={[styles.actionButton, styles.dismissButton]}
                          disabled={busy}
                          onPress={() => askWarnReviewAuthor(report)}>
                          <ThemedText type="smallBold">Warn</ThemedText>
                        </Pressable>
                      )}
                      <Pressable
                        style={[styles.actionButton, styles.flagButton]}
                        disabled={busy}
                        onPress={() => askHideReview(report)}>
                        <ThemedText type="smallBold" style={styles.flagButtonText}>
                          Hide
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.removeButton]}
                        disabled={busy}
                        onPress={() => askRemoveReview(report)}>
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
              ) : activeTab === 'reviews' ? (
                handledReviewReports.map((report) => (
                  <ThemedView key={report.id} type="backgroundElement" style={[styles.card, styles.handledCard]}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/location/[id]', params: { id: report.locationId } })}>
                      <ThemedText type="smallBold">{report.locationName}</ThemedText>
                    </Pressable>
                    <ThemedText type="small" themeColor="textSecondary">
                      {resolutionLabel(report.resolutionAction, inferredReviewLabel(report))} · By{' '}
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
                      {resolutionLabel(report.resolutionAction, inferredLocationLabel(report))} · Reported by{' '}
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
