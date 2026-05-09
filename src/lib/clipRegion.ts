import { ClipRegion } from "@/types/editor";
import {
  WORKSPACE_SIZE,
  SQUIRCLE_SIZE,
  SQUIRCLE_OFFSET,
  ICON_PADDING,
  CLIP_MIN_SIZE,
  CLIP_MAX_SIZE,
} from "./constants";

export type ClipMarginEdge = "top" | "right" | "bottom" | "left";

export interface ClipMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const SQUIRCLE_X = SQUIRCLE_OFFSET + ICON_PADDING;
const SQUIRCLE_Y = SQUIRCLE_OFFSET + ICON_PADDING;
const SQUIRCLE_RIGHT = SQUIRCLE_X + SQUIRCLE_SIZE;
const SQUIRCLE_BOTTOM = SQUIRCLE_Y + SQUIRCLE_SIZE;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function clampClipRegion(region: ClipRegion): ClipRegion {
  const size = clamp(Math.round(region.size), CLIP_MIN_SIZE, CLIP_MAX_SIZE);
  return {
    x: clamp(Math.round(region.x), 0, WORKSPACE_SIZE - size),
    y: clamp(Math.round(region.y), 0, WORKSPACE_SIZE - size),
    size,
  };
}

export function getClipMargins(region: ClipRegion): ClipMargins {
  return {
    top: Math.round(SQUIRCLE_Y - region.y),
    right: Math.round(region.x + region.size - SQUIRCLE_RIGHT),
    bottom: Math.round(region.y + region.size - SQUIRCLE_BOTTOM),
    left: Math.round(SQUIRCLE_X - region.x),
  };
}

function distribute(total: number, first: number, second: number): [number, number] {
  const currentTotal = first + second;
  const ratio = currentTotal > 0 ? first / currentTotal : 0.5;
  const nextFirst = Math.round(total * ratio);
  return [nextFirst, total - nextFirst];
}

export function updateClipMargin(
  region: ClipRegion,
  edge: ClipMarginEdge,
  rawValue: number
): ClipRegion {
  const current = getClipMargins(region);
  const value = clamp(Math.round(Number.isFinite(rawValue) ? rawValue : 0), -120, 320);

  let next = { ...current, [edge]: value };
  let total: number;

  if (edge === "top" || edge === "bottom") {
    total = next.top + next.bottom;
    [next.left, next.right] = distribute(total, current.left, current.right);
  } else {
    total = next.left + next.right;
    [next.top, next.bottom] = distribute(total, current.top, current.bottom);
  }

  const size = SQUIRCLE_SIZE + total;
  return clampClipRegion({
    x: SQUIRCLE_X - next.left,
    y: SQUIRCLE_Y - next.top,
    size,
  });
}

