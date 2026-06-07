import { Typography } from 'antd';
import { useSettings } from '../features/settings/hooks/useSettings';
import { DataManagement } from '../features/settings/components/DataManagement';

export function SettingsPage() {
  const { settings, save, doExport, doImport, doClear } = useSettings();

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>设置</Typography.Title>
      <DataManagement
        settings={settings}
        onSaveSettings={save}
        onExport={doExport}
        onImport={doImport}
        onClear={doClear}
      />
    </div>
  );
}
