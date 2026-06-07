import { useState, useCallback } from 'react';
import {
  getSettings,
  saveSettings,
  exportData,
  importData,
  clearData,
} from '../api/settingsApi';
import type { AppSettings } from '../../../shared/types/domain';

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(() => getSettings());

  const save = useCallback((s: AppSettings) => {
    saveSettings(s);
    setSettingsState(s);
  }, []);

  const doExport = useCallback((): string => {
    const data = exportData();
    return JSON.stringify(data, null, 2);
  }, []);

  const doImport = useCallback((json: string) => {
    const data = JSON.parse(json) as Record<string, unknown>;
    importData(data);
    setSettingsState(getSettings());
  }, []);

  const doClear = useCallback(() => {
    clearData();
    setSettingsState(getSettings());
  }, []);

  return { settings, save, doExport, doImport, doClear };
}
