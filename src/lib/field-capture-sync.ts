export type FieldCaptureFailureInput = {
  isOnline: boolean;
  status?: number;
};

export function shouldQueueFieldCaptureFailure({ isOnline, status }: FieldCaptureFailureInput): boolean {
  if (!isOnline) return true;
  if (status === undefined) return true;
  if (status === 0) return true;
  return status >= 500;
}

export function fieldCaptureFailureMessage(status?: number): string {
  if (status === 422 || status === 400) {
    return "This capture needs review before saving; it was not added to the offline queue.";
  }

  if (status && status >= 400 && status < 500) {
    return "This capture needs account or review attention; it was not added to the offline queue.";
  }

  return "Save failed because the service was unavailable. Saved as an offline field-capture draft.";
}
