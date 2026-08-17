import { setCloudCollection, undoCloudMutation } from './api/collectionApi';
import { addLegacyTrade, deleteLegacyTrade, setLegacyWanted } from './api/legacyTradeApi';
import { applyCloudImport, fetchOwnerBootstrap, previewCloudImport } from './api/ownerApi';
import { fetchPublicCatalog } from './api/publicCatalogApi';

export { ApiClientError, saveAccessToken, storedAccessToken } from './api/request';
export type { BootstrapResponse, ImportApplyResponse, ImportPreviewResponse } from './api/ownerApi';
export type { CollectionMutationResponse, UndoResponse } from './api/collectionApi';

/** Compatibility facade for tests and historical consumers. Production routes import focused modules. */
export const api = {
  catalog: fetchPublicCatalog,
  bootstrap: fetchOwnerBootstrap,
  setCollection: setCloudCollection,
  undo: undoCloudMutation,
  setWanted: setLegacyWanted,
  addTrade: addLegacyTrade,
  deleteTrade: deleteLegacyTrade,
  previewImport: previewCloudImport,
  applyImport: applyCloudImport,
};
