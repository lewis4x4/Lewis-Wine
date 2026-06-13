export type VoiceTastingFailureInput = {
  isOnline: boolean;
  status?: number;
};

export function shouldQueueVoiceTastingFailure({
  isOnline,
  status,
}: VoiceTastingFailureInput): boolean {
  if (!isOnline) return true;
  if (status === undefined) return true;
  if (status === 0) return true;
  return status >= 500;
}

export function voiceTastingFailureMessage(status?: number): string {
  if (status === 422) {
    return "JARVIS needs a clearer bottle match before this can be saved. Review the draft instead of queuing it offline.";
  }

  if (status && status >= 400 && status < 500) {
    return "This tasting needs review before saving; it was not added to the offline queue.";
  }

  return "Save failed because the service was unavailable. Saved as an offline draft.";
}
