import React, { useState, useEffect } from 'react';
import { FiDownload, FiUpload, FiTrash2, FiCheckCircle, FiAlertCircle, FiClock, FiDatabase } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { backupManager } from '../utils/backupManager';
import { LoadingSpinner } from '../components/LoadingSpinner';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import '../css/BackupSettings.css';
import ConfirmDialog from '../components/common/ConfirmDialog';

function BackupSettingsPage() {
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState(24);
  const [selectedBackup, setSelectedBackup] = useState(null);

  useEffect(() => {
    loadBackups();
    loadAutoBackupSettings();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const backupList = await backupManager.listBackups();
      setBackups(backupList);
    } catch (error) {
      console.error('Error loading backups:', error);
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const loadAutoBackupSettings = async () => {
    try {
      const result = await window.electronAPI.getAutoBackupSettings();
      if (result.success) {
        setAutoBackupEnabled(result.enabled);
        setAutoBackupInterval(result.intervalHours);
      }
    } catch (error) {
      console.error('Error loading auto-backup settings:', error);
    }
  };

  const handleCreateBackup = async () => {
    if (isCreatingBackup) return;

    setIsCreatingBackup(true);
    const toastId = toast.loading('Creating backup...');

    try {
      const result = await backupManager.createBackup({
        includeDocuments: true,
        compress: true,
      });

      toast.success(`Backup created successfully!\nSize: ${backupManager.formatBytes(result.backupSize)}`, {
        id: toastId,
        duration: 5000,
      });

      await loadBackups();
    } catch (error) {
      console.error('Backup error:', error);
      toast.error(`Failed to create backup: ${error.message}`, { id: toastId });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backup) => {
    setConfirmPayload({ type: 'restore', backup });
    setConfirmOpen(true);
  };

  const handleDeleteBackup = async (backup) => {
    setConfirmPayload({ type: 'delete', backup });
    setConfirmOpen(true);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);

  const performConfirmAction = async () => {
    if (!confirmPayload) return;
    const { type, backup } = confirmPayload;
    if (type === 'restore') {
      setIsRestoring(true);
      const toastId = toast.loading('Restoring backup...');
      try {
        const result = await backupManager.restoreBackup(backup.path);
        toast.success(
          `Backup restored successfully!\n${result.recordsRestored} records restored.\n\nPlease restart the application.`,
          { id: toastId, duration: 8000 }
        );

        // ask for restart using confirm dialog
        setTimeout(() => {
          setConfirmPayload({ type: 'restart' });
          setConfirmOpen(true);
        }, 2000);
      } catch (error) {
        console.error('Restore error:', error);
        toast.error(`Failed to restore backup: ${error.message}`, { id: toastId });
      } finally {
        setIsRestoring(false);
        setConfirmOpen(false);
        setConfirmPayload(null);
      }
    } else if (type === 'delete') {
      try {
        await backupManager.deleteBackup(backup.path);
        toast.success('Backup deleted successfully');
        await loadBackups();
      } catch (error) {
        console.error('Delete error:', error);
        toast.error(`Failed to delete backup: ${error.message}`);
      } finally {
        setConfirmOpen(false);
        setConfirmPayload(null);
      }
    } else if (type === 'restart') {
      window.electronAPI.restartApplication();
    }
  };

  const handleVerifyBackup = async (backup) => {
    const toastId = toast.loading('Verifying backup integrity...');

    try {
      const result = await backupManager.verifyBackup(backup.path);
      
      if (result.valid) {
        toast.success('Backup is valid and can be restored safely', { id: toastId });
      } else {
        toast.error(`Backup is corrupted: ${result.error}`, { id: toastId });
      }
    } catch (error) {
      console.error('Verify error:', error);
      toast.error(`Failed to verify backup: ${error.message}`, { id: toastId });
    }
  };

  const handleExportData = async (format) => {
    const toastId = toast.loading(`Exporting data to ${format.toUpperCase()}...`);

    try {
      const result = await backupManager.exportData({
        format,
        tables: ['candidates', 'employers', 'jobs', 'payments'],
      });

      toast.success(
        `Data exported successfully!\n${result.recordCount} records exported.`,
        { id: toastId, duration: 5000 }
      );
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export data: ${error.message}`, { id: toastId });
    }
  };

  const handleAutoBackupToggle = async () => {
    try {
      const newEnabled = !autoBackupEnabled;
      const result = await backupManager.scheduleAutoBackup(
        newEnabled ? autoBackupInterval : 0
      );

      if (result.success) {
        setAutoBackupEnabled(newEnabled);
        toast.success(
          newEnabled 
            ? `Auto-backup enabled (every ${autoBackupInterval} hours)`
            : 'Auto-backup disabled'
        );
      }
    } catch (error) {
      console.error('Auto-backup toggle error:', error);
      toast.error('Failed to update auto-backup settings');
    }
  };

  const handleIntervalChange = async (newInterval) => {
    setAutoBackupInterval(newInterval);
    
    if (autoBackupEnabled) {
      try {
        await backupManager.scheduleAutoBackup(newInterval);
        toast.success(`Auto-backup interval updated to ${newInterval} hours`);
      } catch (error) {
        console.error('Interval update error:', error);
        toast.error('Failed to update interval');
      }
    }
  };

  // Only super_admin can access
  if (user?.role !== 'super_admin') {
    return (
      <div className="backup-settings-page">
        <div className="access-denied">
          <FiAlertCircle />
          <h2>Access Denied</h2>
          <p>Only Super Administrators can access backup settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="backup-settings-page">
      <div className="page-header">
        <div>
          <h1><FiDatabase /> Database Backup & Restore</h1>
          <p>Manage your database backups and export data</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className="btn btn-primary"
          onClick={handleCreateBackup}
          disabled={isCreatingBackup || isRestoring}
        >
          {isCreatingBackup ? (
            <>
              <LoadingSpinner size="small" />
              Creating Backup...
            </>
          ) : (
            <>
              <FiDownload /> Create Backup Now
            </>
          )}
        </button>

        <button 
          className="btn btn-secondary"
          onClick={() => handleExportData('csv')}
          disabled={isCreatingBackup || isRestoring}
        >
          <FiUpload /> Export to CSV
        </button>

        <button 
          className="btn btn-secondary"
          onClick={() => handleExportData('excel')}
          disabled={isCreatingBackup || isRestoring}
        >
          <FiUpload /> Export to Excel
        </button>
      </div>

      {/* Auto-Backup Settings */}
      <div className="settings-card">
        <div className="card-header">
          <h3><FiClock /> Automatic Backup</h3>
        </div>
        <div className="card-body">
          <div className="auto-backup-controls">
            <div className="toggle-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={handleAutoBackupToggle}
                  disabled={isCreatingBackup || isRestoring}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">
                {autoBackupEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {autoBackupEnabled && (
              <div className="interval-control">
                <label htmlFor="backup-interval">Backup Interval:</label>
                <select
                  id="backup-interval"
                  value={autoBackupInterval}
                  onChange={(e) => handleIntervalChange(Number(e.target.value))}
                  disabled={isCreatingBackup || isRestoring}
                >
                  <option value={1}>Every Hour</option>
                  <option value={6}>Every 6 Hours</option>
                  <option value={12}>Every 12 Hours</option>
                  <option value={24}>Daily</option>
                  <option value={168}>Weekly</option>
                </select>
              </div>
            )}
          </div>
          <p className="help-text">
            Automatic backups will be created in the background at the specified interval.
          </p>
        </div>
      </div>

      {/* Backup List */}
      <div className="backup-list-card">
        <div className="card-header">
          <h3>Available Backups ({backups.length})</h3>
          <button 
            className="btn btn-secondary btn-small"
            onClick={loadBackups}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="small" /> : 'Refresh'}
          </button>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">
              <LoadingSpinner />
              <p>Loading backups...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="empty-state">
              <FiDatabase />
              <p>No backups available</p>
              <small>Create your first backup to get started</small>
            </div>
          ) : (
            <div className="backup-table">
              <table>
                <thead>
                  <tr>
                    <th>Backup Name</th>
                    <th>Created</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup, index) => (
                    <tr key={index} className={selectedBackup === backup ? 'selected' : ''}>
                      <td>
                        <div className="backup-name">
                          <FiCheckCircle className="backup-icon" />
                          {backup.name}
                        </div>
                      </td>
                      <td>{backup.created.toLocaleString()}</td>
                      <td>{backup.sizeFormatted}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon restore"
                            onClick={() => handleRestoreBackup(backup)}
                            disabled={isRestoring || isCreatingBackup}
                            title="Restore this backup"
                          >
                            <FiUpload />
                          </button>
                          <button
                            className="btn-icon verify"
                            onClick={() => handleVerifyBackup(backup)}
                            disabled={isRestoring || isCreatingBackup}
                            title="Verify backup integrity"
                          >
                            <FiCheckCircle />
                          </button>
                          <button
                            className="btn-icon delete"
                            onClick={() => handleDeleteBackup(backup)}
                            disabled={isRestoring || isCreatingBackup}
                            title="Delete backup"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Warning Notice */}
      <div className="warning-notice">
        <FiAlertCircle />
        <div>
          <strong>Important:</strong> Always verify backups before restoring. 
          Restoring a backup will replace all current data and cannot be undone.
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirmPayload?.type === 'restore' ? 'Restore Backup' : confirmPayload?.type === 'delete' ? 'Delete Backup' : 'Confirm Action'}
        message={
          confirmPayload?.type === 'restore'
            ? `⚠️ This will restore backup ${confirmPayload.backup?.name}. Current data will be replaced. Continue?`
            : confirmPayload?.type === 'delete'
            ? `Are you sure you want to delete backup ${confirmPayload.backup?.name}? This cannot be undone.`
            : 'Are you sure?'
        }
        isDanger={confirmPayload?.type === 'restore' || confirmPayload?.type === 'delete'}
        confirmText={confirmPayload?.type === 'delete' ? 'Delete' : confirmPayload?.type === 'restore' ? 'Restore' : 'Confirm'}
        cancelText="Cancel"
        onConfirm={performConfirmAction}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmPayload(null);
        }}
      />
    </div>
  );
}

export default BackupSettingsPage;
import { useCallback, useState } from 'react';
import { sanitizeObject } from '../utils/sanitize';