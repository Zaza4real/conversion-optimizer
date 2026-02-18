/**
 * Event types and payload shapes for pixel and backend.
 */

export const PIXEL_EVENT_TYPES = [
  'page_view',
  'product_view',
  'add_to_cart',
  'begin_checkout',
  'purchase',
  'experiment_exposure',
] as const;

export type PixelEventType = (typeof PIXEL_EVENT_TYPES)[number];

export interface PixelEventPayload {
  event_type: PixelEventType;
  timestamp: string;
  anon_id: string;
  session_id: string;
  props: Record<string, unknown>;
  product_id?: string;
  experiment_id?: string;
  variant?: string;
}

export interface ExperimentExposureProps {
  url?: string;
  target?: string;
}

export interface PurchaseProps {
  order_id?: string;
  value?: number;
  currency?: string;
}
