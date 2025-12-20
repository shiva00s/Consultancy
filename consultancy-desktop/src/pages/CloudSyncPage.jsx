import React, { useState, useEffect } from 'react';
import { FiCloud, FiUpload, FiDownload, FiRefreshCw, FiSettings } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/CloudSync.css';
import ConfirmDialog from '../components/common/ConfirmDialog';

const CloudSyncPage = () => {
  const [provider, setProvider] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    provider: 'google',
    clientId: '',
    clientSecret: '',
    redirectUri: 'http://localhost',
    refreshToken: '',
    accessToken: '',
    serverUrl: '',
    apiKey: ''
  });

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await window.api.getSyncStatus();
      setSyncStatus(status);
      setProvider(status.provider);
      
      if (status.isConfigured) {
        loadBackups();
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const loadBackups = async () => {
    try {
      const result = await window.api.listBackups();
      if (result.success) {
        setBackups(result.backups || []);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
      toast.error('Failed to load backups');
    }
  };

  const handleInitSync = async () => {
    setLoading(true);
    try {
      const providerConfig = {
        google: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
          refreshToken: config.refreshToken
        },
        dropbox: {
          accessToken: config.accessToken
        },
        custom: {
          serverUrl: config.serverUrl,
          apiKey: config.apiKey
        }
      };

      const result = await window.api.initCloudSync(
        config.provider,
        providerConfig[config.provider]
      );

      if (result.success) {
        toast.success(result.message);
        setShowConfig(false);
        loadSyncStatus();
      }
    } catch (error) {
      console.error('Sync init failed:', error);
      toast.error('Failed to initialize cloud sync');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const result = await window.api.createBackup();
      if (result.success) {
        toast.success('Backup created successfully!');
        loadBackups();
      }
    } catch (error) {
      console.error('Backup failed:', error);
      toast.error('Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (fileId) => {
    setConfirmFileId(fileId);
    setConfirmOpen(true);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmFileId, setConfirmFileId] = useState(null);

  const performRestore = async () => {
    if (!confirmFileId) return;
    setLoading(true);
    try {
      const result = await window.api.restoreBackup(confirmFileId);
      if (result.success) {
        toast.success('Backup restored! Please restart the application.');
      }
    } catch (error) {
      console.error('Restore failed:', error);
      toast.error('Failed to restore backup');
    } finally {
      setLoading(false);
      setConfirmOpen(false);
      setConfirmFileId(null);
    }
  };

  const handleEnableAutoSync = async (schedule) => {
    setLoading(true);
    try {
      const result = await window.api.enableAutoSync(schedule);
      if (result.success) {
        toast.success(result.message);
        loadSyncStatus();
      }
    } catch (error) {
      console.error('Auto-sync failed:', error);
      toast.error('Failed to enable auto-sync');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="cloud-sync-page">
      <div className="page-header">
        <div>
          <h1>☁️ Cloud Sync & Backup</h1>
          <p>Securely backup and restore your data to the cloud</p>
        </div>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="btn-secondary"
        >
          <FiSettings /> Configure
        </button>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="config-panel">
          <h3>Cloud Provider Configuration</h3>
          
          <div className="provider-selector">
            <label>
              <input
                type="radio"
                value="google"
                checked={config.provider === 'google'}
                onChange={(e) => setConfig({ ...config, provider: e.target.value })}
              />
              Google Drive
            </label>
            <label>
              <input
                type="radio"
                value="dropbox"
                checked={config.provider === 'dropbox'}
                onChange={(e) => setConfig({ ...config, provider: e.target.value })}
              />
              Dropbox
            </label>
            <label>
              <input
                type="radio"
                value="custom"
                checked={config.provider === 'custom'}
                onChange={(e) => setConfig({ ...config, provider: e.target.value })}
              />
              Custom Server
            </label>
          </div>

          {/* Google Drive Config */}
          {config.provider === 'google' && (
            <div className="config-fields">
              <input
                type="text"
                placeholder="Client ID"
                value={config.clientId}
                onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
              />
              <input
                type="text"
                placeholder="Client Secret"
                value={config.clientSecret}
                onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
              />
              <input
                type="text"
                placeholder="Refresh Token"
                value={config.refreshToken}
                onChange={(e) => setConfig({ ...config, refreshToken: e.target.value })}
              />
            </div>
          )}

          {/* Dropbox Config */}
          {config.provider === 'dropbox' && (
            <div className="config-fields">
              <input
                type="text"
                placeholder="Access Token"
                value={config.accessToken}
                onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
              />
            </div>
          )}

          {/* Custom Server Config */}
          {config.provider === 'custom' && (
            <div className="config-fields">
              <input
                type="text"
                placeholder="Server URL"
                value={config.serverUrl}
                onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
              />
              <input
                type="text"
                placeholder="API Key"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
            </div>
          )}

          <button 
            onClick={handleInitSync}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Connecting...' : 'Connect & Save'}
          </button>
        </div>
      )}

      {/* Sync Status */}
      {syncStatus && syncStatus.isConfigured && (
        <div className="sync-status">
          <div className="status-card">
            <div className="status-icon">☁️</div>
            <div className="status-info">
              <div className="status-label">Provider</div>
              <div className="status-value">{syncStatus.provider}</div>
            </div>
          </div>
          <div className="status-card">
            <div className="status-icon">🕐</div>
            <div className="status-info">
              <div className="status-label">Last Sync</div>
              <div className="status-value">
                {syncStatus.lastSyncTime ? formatDate(syncStatus.lastSyncTime) : 'Never'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {syncStatus && syncStatus.isConfigured && (
        <div className="sync-actions">
          <button 
            onClick={handleCreateBackup}
            disabled={loading}
            className="btn-primary"
          >
            <FiUpload /> {loading ? 'Creating...' : 'Create Backup Now'}
          </button>
          
          <button 
            onClick={() => loadBackups()}
            disabled={loading}
            className="btn-secondary"
          >
            <FiRefreshCw /> Refresh List
          </button>

          <select 
            onChange={(e) => e.target.value && handleEnableAutoSync(e.target.value)}
            className="auto-sync-select"
          >
            <option value="">Enable Auto-Sync</option>
            <option value="hourly">Every Hour</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      )}

      {/* Backups List */}
      <div className="backups-section">
        <h3>Available Backups</h3>
        
        {backups.length === 0 ? (
          <div className="empty-state">
            <FiCloud size={48} />
            <p>No backups found</p>
          </div>
        ) : (
          <div className="backups-list">
            {backups.map((backup) => (
              <div key={backup.id} className="backup-item">
                <div className="backup-icon">📦</div>
                <div className="backup-info">
                  <div className="backup-name">{backup.name}</div>
                  <div className="backup-meta">
                    <span>{formatSize(backup.size)}</span>
                    <span>{formatDate(backup.createdTime || backup.uploadedAt)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleRestoreBackup(backup.id)}
                  disabled={loading}
                  className="btn-restore"
                >
                  <FiDownload /> Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Restore Backup"
        message="Are you sure? This will replace all current data with the backup."
        isDanger={true}
        confirmText="Restore"
        cancelText="Cancel"
        onConfirm={performRestore}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default CloudSyncPage;
