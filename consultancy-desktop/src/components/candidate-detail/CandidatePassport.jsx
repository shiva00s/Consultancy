import React, { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiUpload, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import PassportReceiveForm from './PassportReceiveForm';
import PassportSendForm from './PassportSendForm';
import PassportHistoryTimeline from './PassportHistoryTimeline';
import PassportPhotoGallery from './PassportPhotoGallery';
import '../../css/passport-tracking/PassportTracking.css';
//import '../../css/CandidatePassport.css';

function CandidatePassport({ candidateId, candidateData }) {
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  const [activeTab, setActiveTab] = useState('receive');
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [viewingPhotos, setViewingPhotos] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Fetch staff list
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        if (window.electronAPI?.getUsers) {
          const result = await window.electronAPI.getUsers({ user });
          if (result.success && result.data) {
            const names = result.data.map(u => u.fullName).filter(Boolean);
            setStaffList(names);
          }
        } else {
          if (user?.fullName) {
            setStaffList([user.fullName]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch staff:', error);
      }
    };
    fetchStaff();
  }, [user]);

  // Fetch movements
  const fetchMovements = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getPassportMovements({ candidateId, user });
    if (res.success) {
      setMovements(res.data || []);
    } else {
      toast.error(res.error || 'Failed to fetch movements');
    }
    setLoading(false);
  }, [candidateId, user]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Handle successful form submission
  const handleMovementAdded = (newMovement) => {
    setMovements(prev => [newMovement, ...prev]);
    setActiveTab('history');
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this movement record?')) return;

    const res = await window.electronAPI.deletePassportMovement({ id, user });
    if (res.success) {
      setMovements(prev => prev.filter(m => m.id !== id));
      toast.success('Movement deleted');
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  // View photos
  const handleViewPhotos = async (movementId) => {
    const res = await window.electronAPI.getPassportMovementPhotos({ movementId, user });
    if (res.success && res.data && res.data.length > 0) {
      setViewingPhotos(res.data);
      setCurrentPhotoIndex(0);
    } else {
      toast.error('No photos found');
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="passport-tracking-content">
      {/* Photo Gallery Viewer */}
      <PassportPhotoGallery
        viewingPhotos={viewingPhotos}
        currentPhotoIndex={currentPhotoIndex}
        setCurrentPhotoIndex={setCurrentPhotoIndex}
        onClose={() => setViewingPhotos(null)}
      />

      {/* Tabs */}
      <div className="passport-tabs">
        <button 
          className={`tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
          onClick={() => setActiveTab('receive')}
        >
          <FiDownload />
          📥 Receive Passport
        </button>
        <button 
          className={`tab-btn ${activeTab === 'send' ? 'active' : ''}`}
          onClick={() => setActiveTab('send')}
        >
          <FiUpload />
          📤 Send Passport
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <FiClock />
          📜 Movement History
          {movements.length > 0 && <span className="badge">{movements.length}</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'receive' && (
          <PassportReceiveForm
            candidateId={candidateId}
            user={user}
            staffList={staffList}
            onSuccess={handleMovementAdded}
          />
        )}

        {activeTab === 'send' && (
          <PassportSendForm
            candidateId={candidateId}
            user={user}
            staffList={staffList}
            onSuccess={handleMovementAdded}
          />
        )}

        {activeTab === 'history' && (
          <PassportHistoryTimeline
            movements={movements}
            onDelete={handleDelete}
            onViewPhotos={handleViewPhotos}
            onAddNew={() => setActiveTab('receive')}
          />
        )}
      </div>
    </div>
  );
}

export default CandidatePassport;
