/**
 * @module ChangelogNotificationModal
 * @description "What's New" modal shown when unseen changelog entries exist.
 * Uses the existing Modal component. Scrollable entry list with "Don't show again"
 * checkbox and "Got it" dismiss button.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ChangelogNotificationEntry } from "./ChangelogNotificationEntry";
import { useChangelogNotifications, type ChangelogEntry } from "@/hooks/use-changelog-notifications";
import { communityApi } from "@/lib/community-api";

export function ChangelogNotificationModal() {
  const {
    unseenEntries,
    allEntries,
    modalOpen,
    setModalOpen,
    dismissAll,
    disableAndDismiss,
  } = useChangelogNotifications();

  const [dontShowAgain, setDontShowAgain] = useState(false);

  const changelogIds = useMemo(
    () => allEntries.map((entry: ChangelogEntry) => entry._id as never),
    [allEntries]
  );

  const reactionCounts = useQuery(
    communityApi.changelog.reactionCounts,
    changelogIds.length > 0 ? { changelogIds } : "skip"
  ) as Record<string, number> | undefined;

  const entriesToShow = unseenEntries.length > 0 ? unseenEntries : allEntries;

  const handleDismiss = () => {
    if (dontShowAgain) {
      disableAndDismiss();
    } else {
      dismissAll();
    }
    setDontShowAgain(false);
  };

  return (
    <Modal
      open={modalOpen}
      onClose={handleDismiss}
      title="What's New"
      className="max-w-xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(evt) => setDontShowAgain(evt.target.checked)}
              className="w-3.5 h-3.5 accent-accent-primary"
            />
            <span className="text-xs text-text-secondary">Don&apos;t show again</span>
          </label>
          <Button variant="primary" size="sm" onClick={handleDismiss}>
            Got it
          </Button>
        </div>
      }
    >
      <div className="max-h-[50vh] overflow-y-auto -mx-4 px-4">
        {entriesToShow.length === 0 ? (
          <p className="text-sm text-text-tertiary py-4 text-center">No updates yet.</p>
        ) : (
          entriesToShow.map((entry) => (
            <ChangelogNotificationEntry
              key={entry._id}
              entry={entry}
              reactionCount={reactionCounts?.[entry._id] ?? 0}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
