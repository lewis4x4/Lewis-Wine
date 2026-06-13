import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from "date-fns";
import { JARVIS_CAPTURE_PREVIEW_LIMIT } from "@/lib/jarvis/constants";

export function formatJarvisDate(date: string | null | undefined) {
  if (!date) {
    return "No date set";
  }

  const parsed = parseISO(date);
  return format(parsed, "MMM d, yyyy");
}

export function formatJarvisDateTime(date: string | null | undefined) {
  if (!date) {
    return "Time not set";
  }

  const parsed = parseISO(date);
  return format(parsed, "MMM d, yyyy 'at' h:mm a");
}

export function formatJarvisRelativeTime(date: string | null | undefined) {
  if (!date) {
    return "No timestamp";
  }

  return formatDistanceToNow(parseISO(date), { addSuffix: true });
}

export function summarizeCaptureContent(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");

  if (normalized.length <= JARVIS_CAPTURE_PREVIEW_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, JARVIS_CAPTURE_PREVIEW_LIMIT).trimEnd()}…`;
}

export function normalizeParticipants(input: string) {
  return input
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function getTimelineGroupLabel(date: string) {
  const parsed = parseISO(date);

  if (isToday(parsed)) {
    return "Today";
  }

  if (isYesterday(parsed)) {
    return "Yesterday";
  }

  return format(startOfDay(parsed), "EEEE, MMM d");
}
