import type { PublicCatalogPayload } from '../../../shared/types';
import { requestJson } from './request';
export function fetchPublicCatalog(): Promise<PublicCatalogPayload> {
  return requestJson('/api/v1/catalog');
}
