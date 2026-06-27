import { client } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import { unwrap, unwrapNullable } from '../../../shared/api/unwrappers';
import { getSettings } from '../../settings/api/settingsApi';
import {
  cancelLocalPositionSnapshot,
  confirmLocalPositionSnapshot,
  createLocalPositionSnapshot,
  getLatestLocalPositionSnapshot,
  getLocalPositionSnapshotById,
  listLocalPositionSnapshots,
  updateLocalPositionSnapshot,
} from './positionSnapshotLocalStorage';
import type {
  PositionSnapshotDetail,
  PositionSnapshotFilter,
  PositionSnapshotSaveInput,
  PositionSnapshotSummary,
  PositionSnapshotUpdateInput,
} from '../model/types';

export interface PositionSnapshotApi {
  list(filter?: PositionSnapshotFilter): Promise<PositionSnapshotSummary[]>;
  getLatest(): Promise<PositionSnapshotDetail | null>;
  getById(id: string | number): Promise<PositionSnapshotDetail>;
  create(input: PositionSnapshotSaveInput): Promise<PositionSnapshotDetail>;
  update(id: string | number, input: PositionSnapshotUpdateInput): Promise<PositionSnapshotDetail>;
  confirm(id: string | number): Promise<PositionSnapshotDetail>;
  cancel(id: string | number): Promise<PositionSnapshotDetail>;
}

const mockApi: PositionSnapshotApi = {
  async list(filter) { return listLocalPositionSnapshots(filter); },
  async getLatest() { return getLatestLocalPositionSnapshot(); },
  async getById(id) { return getLocalPositionSnapshotById(id); },
  async create(input) { return createLocalPositionSnapshot(input); },
  async update(id, input) { return updateLocalPositionSnapshot(id, input); },
  async confirm(id) { return confirmLocalPositionSnapshot(id); },
  async cancel(id) { return cancelLocalPositionSnapshot(id); },
};

function compactFilter(filter?: PositionSnapshotFilter): Record<string, string | boolean> {
  if (!filter) return {};
  return Object.fromEntries(
    Object.entries(filter).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | boolean>;
}

const remoteApi: PositionSnapshotApi = {
  async list(filter) {
    return unwrap(client.get<ApiResponse<PositionSnapshotSummary[]>>('/position-snapshots', { params: compactFilter(filter) }));
  },
  async getLatest() {
    return unwrapNullable(client.get<ApiResponse<PositionSnapshotDetail>>('/position-snapshots/latest'));
  },
  async getById(id) {
    return unwrap(client.get<ApiResponse<PositionSnapshotDetail>>(`/position-snapshots/${id}`));
  },
  async create(input) {
    return unwrap(client.post<ApiResponse<PositionSnapshotDetail>>('/position-snapshots', input));
  },
  async update(id, input) {
    return unwrap(client.put<ApiResponse<PositionSnapshotDetail>>(`/position-snapshots/${id}`, input));
  },
  async confirm(id) {
    return unwrap(client.patch<ApiResponse<PositionSnapshotDetail>>(`/position-snapshots/${id}/confirm`));
  },
  async cancel(id) {
    return unwrap(client.patch<ApiResponse<PositionSnapshotDetail>>(`/position-snapshots/${id}/cancel`));
  },
};

function pick(): PositionSnapshotApi {
  return getSettings().apiMode === 'remote' ? remoteApi : mockApi;
}

export const positionSnapshotApi: PositionSnapshotApi = {
  list: (filter) => pick().list(filter),
  getLatest: () => pick().getLatest(),
  getById: (id) => pick().getById(id),
  create: (input) => pick().create(input),
  update: (id, input) => pick().update(id, input),
  confirm: (id) => pick().confirm(id),
  cancel: (id) => pick().cancel(id),
};
