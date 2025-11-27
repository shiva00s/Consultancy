import React, { useState } from 'react';
import { FiSave, FiAlertTriangle, FiCheckCircle, FiHardDrive } from 'react-icons/fi'; // <-- ADDED FiHardDrive
import toast from 'react-hot-toast'; 
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';

function BackupUtility() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore(
    useShallow((state) => ({ user: state.user }))
  );

  const handleBackup = async () => {
    setLoading(true);

    try {
      // 1. Open the Electron Save Dialog - MODIFIED FOR ZIP
      const dialogResult = await window.electronAPI.showSaveDialog({
        title: 'Save Application Backup (Database + Files)',
        defaultPath: `consultancy_backup_${new Date().toISOString().slice(0, 10)}.zip`,
        buttonLabel: 'Save Backup',
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
      });

      // User cancelled the dialog
      if (dialogResult.canceled || !dialogResult.filePath) {
        setLoading(false);
        return; 
      }

      const destinationPath = dialogResult.filePath;
      toast.loading('Processing Backup...', { id: 'backup-status' }); 

      // 2. Call the backend IPC handler (now zips the files)
     const res = await window.electronAPI.backupDatabase({ user, destinationPath });
      
      toast.dismiss('backup-status'); 

      if (res.success) {
        toast.success(`Backup successful! ZIP file saved to: ${destinationPath}`, { duration: 5000 }); 
      } else {
        toast.error(`Backup failed: ${res.error}`); 
      }
    } catch (err) {
      toast.error(`An unexpected error occurred during backup: ${err.message}`); 
    }

    setLoading(false);
  };

  return (
    <div className="settings-section-card backup-section"> {/* <-- ADDED CARD WRAPPER */}
        <h2><FiHardDrive /> Data & Backup Utility</h2>
        <p>
            The application data is stored in a database and a file directory. It is critical to regularly back up this data.
            This feature copies the current database AND all uploaded candidate files into a single `.zip` file.
        </p>

        <button 
            className="btn" 
            onClick={handleBackup} 
            disabled={loading}
        >
            {loading ? 'Processing Backup...' : <><FiSave /> Run Full Backup (.zip)</>}
        </button>

        <p style={{marginTop: '2rem'}}>
            <strong style={{color: 'var(--danger-color)'}}>NOTE:</strong> This feature backs up both the database (`.db`) and all uploaded candidate files.
        </p>
    </div>
  );
}

export default BackupUtility;