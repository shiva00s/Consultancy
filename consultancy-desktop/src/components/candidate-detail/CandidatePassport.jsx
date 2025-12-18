import React, { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiUpload, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import PassportReceiveForm from './PassportReceiveForm';
import PassportSendForm from './PassportSendForm';
import PassportHistoryTimeline from './PassportHistoryTimeline';
import '../../css/passport-tracking/PassportTracking.css';


function CandidatePassport({ candidateId, candidateData }) {
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  const [activeTab, setActiveTab] = useState('receive');
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  
  // ✅ Track which movements exist
  const [existingMovements, setExistingMovements] = useState({
    receive: false,
    send: false,
  });


  // Fetch staff list
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        if (window.electronAPI?.getUsers) {
          const result = await window.electronAPI.getUsers({ user });
          
          if (result.success && result.data) {
            const names = result.data
              .map(u => u.fullName || u.file_name || u.name)
              .filter(Boolean);
            
            setStaffList(names);
          } else {
            if (user?.fullName) {
              setStaffList([user.fullName]);
            }
          }
        } else {
          if (user?.fullName) {
            setStaffList([user.fullName]);
          }
        }
      } catch (error) {
        if (user?.fullName) {
          setStaffList([user.fullName]);
        }
      }
    };
    
    fetchStaff();
  }, [user]);


  // ✅ Fetch movements with movement type check
  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getPassportMovements({ 
        candidateId, 
        user 
      });
      
      if (res.success) {
        const data = res.data || [];
        setMovements(data);


        // ✅ Check which movements exist based on type
        const hasReceive = data.some((m) => m.type === 'RECEIVE');
        const hasSend = data.some((m) => m.type === 'SEND');


        setExistingMovements({ receive: hasReceive, send: hasSend });


        // Auto-select available tab
        if (hasReceive && !hasSend) {
          setActiveTab('send');
        } else if (!hasReceive && hasSend) {
          setActiveTab('receive');
        } else if (hasReceive && hasSend) {
          setActiveTab('history');
        }
      } else {
        console.error('Failed to fetch movements:', res.error);
        toast.error(res.error || 'Failed to fetch movements');
        setMovements([]);
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast.error('Failed to load movements');
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [candidateId, user]);


  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);


  // ✅ Handle tab click with disabled check
  const handleTabClick = (tab) => {
    // History is always clickable
    if (tab === 'history') {
      setActiveTab(tab);
      return;
    }


    // Don't allow clicking disabled tabs
    if (tab === 'receive' && existingMovements.receive) return;
    if (tab === 'send' && existingMovements.send) return;


    setActiveTab(tab);
  };


  // ✅ Handle successful form submission
  const handleMovementAdded = (newMovement) => {
    toast.success('Movement recorded successfully');
    
    // Refresh movements list
    setTimeout(() => {
      fetchMovements();
    }, 300);
  };


  // ✅ Handle movement deletion (called from timeline)
  const handleMovementDeleted = () => {
    // Refresh the movements list after deletion
    fetchMovements();
  };


  if (loading) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        color: 'rgba(255, 255, 255, 0.7)' 
      }}>
        Loading passport movements...
      </div>
    );
  }


  return (
    <div className="passport-tracking-content">
      {/* Tabs */}
      <div className="passport-tabs">
        <button 
          className={`tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
          onClick={() => handleTabClick('receive')}
          disabled={existingMovements.receive}
        >
          <FiDownload />
          Receive
          {existingMovements.receive && <span className="badge-completed">✓</span>}
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'send' ? 'active' : ''}`}
          onClick={() => handleTabClick('send')}
          disabled={existingMovements.send}
        >
          <FiUpload />
          Send
          {existingMovements.send && <span className="badge-completed">✓</span>}
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => handleTabClick('history')}
        >
          <FiClock />
          History
          {movements.length > 0 && (
            <span className="badge">{movements.length}</span>
          )}
        </button>
      </div>


      {/* Tab Content */}
      <div className="tab-content">
        {/* Receive Form */}
        {activeTab === 'receive' && !existingMovements.receive && (
          <PassportReceiveForm
            candidateId={candidateId}
            user={user}
            staffList={staffList}
            onSuccess={handleMovementAdded}
          />
        )}


        {/* Send Form */}
        {activeTab === 'send' && !existingMovements.send && (
          <PassportSendForm
            candidateId={candidateId}
            user={user}
            staffList={staffList}
            onSuccess={handleMovementAdded}
          />
        )}


        {/* History Timeline */}
        {activeTab === 'history' && (
          <PassportHistoryTimeline
            movements={movements}
            user={user}
            onMovementDeleted={handleMovementDeleted}
          />
        )}


        {/* Show message if tab is already completed */}
        {((activeTab === 'receive' && existingMovements.receive) ||
          (activeTab === 'send' && existingMovements.send)) && (
          <div className="message-already-exists">
            <p className="text-lg">✓ Entry Already Recorded</p>
            <p className="text-sm">
              This passport {activeTab} entry has been completed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


export default CandidatePassport;
