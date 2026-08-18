import type {
  TradeOfferTrait,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../../../shared/types';
import { requestJson } from './request';
/** Compatibility-only calls retained outside the eager public bundle. */
export function setLegacyWanted(input: {
  formId: string;
  traitId: TradeRequestTrait;
  wanted: boolean;
}): Promise<WantedEntry> {
  return requestJson('/api/v1/wanted', { method: 'PUT', body: JSON.stringify(input) });
}
export function addLegacyTrade(input: {
  formId: string;
  traits: TradeOfferTrait[];
  quantity: number;
  notes: string;
}): Promise<TradeSpecimen> {
  return requestJson('/api/v1/trades', { method: 'POST', body: JSON.stringify(input) });
}
export function deleteLegacyTrade(id: string): Promise<void> {
  return requestJson(`/api/v1/trades/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
