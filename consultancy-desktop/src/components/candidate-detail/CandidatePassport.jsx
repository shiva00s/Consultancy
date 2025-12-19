import React, { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiUpload, FiClock, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Tabs from "./Passport/Tabs";
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

  // Fetch movements
  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getPassportMovements({ candidateId, user });
      
      if (res.success) {
        const data = res.data || [];
        setMovements(data);

        // Check which movements exist
        const hasReceive = data.some((m) => m.type === 'RECEIVE');
        const hasSend = data.some((m) => m.type === 'SEND');
        
        setExistingMovements({
          receive: hasReceive,
          send: hasSend
        });

        // Auto-select appropriate tab
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

  // Handle successful form submission
  const handleMovementAdded = (newMovement) => {
    toast.success('✅ Movement recorded successfully');
    setTimeout(() => {
      fetchMovements();
    }, 300);
  };

  // Handle movement deletion
  const handleMovementDeleted = () => {
    fetchMovements();
  };

  // Define tabs with enhanced styling
  const tabs = [
    {
      key: 'receive',
      label: 'Receive Passport',
      icon: '📥',
      disabled: existingMovements.receive,
      content: existingMovements.receive ? (
        <div className="tab-completed-state">
          <div className="completed-icon">
            <FiCheckCircle />
          </div>
          <h3>✓ Passport Received</h3>
          <p>This passport receive entry has been completed and recorded.</p>
          <button 
            className="btn-view-history"
            onClick={() => setActiveTab('history')}
          >
            <FiClock /> View History
          </button>
        </div>
      ) : (
        <PassportReceiveForm
          candidateId={candidateId}
          user={user}
          staffList={staffList}
          onSuccess={handleMovementAdded}
        />
      )
    },
    {
      key: 'send',
      label: 'Send Passport',
      icon: '📤',
      disabled: existingMovements.send,
      content: existingMovements.send ? (
        <div className="tab-completed-state">
          <div className="completed-icon">
            <FiCheckCircle />
          </div>
          <h3>✓ Passport Sent</h3>
          <p>This passport send entry has been completed and recorded.</p>
          <button 
            className="btn-view-history"
            onClick={() => setActiveTab('history')}
          >
            <FiClock /> View History
          </button>
        </div>
      ) : (
        <PassportSendForm
          candidateId={candidateId}
          user={user}
          staffList={staffList}
          onSuccess={handleMovementAdded}
        />
      )
    },
    {
      key: 'history',
      label: 'History',
      icon: '📜',
      badge: movements.length > 0 ? movements.length : null,
      content: (
        <PassportHistoryTimeline
          movements={movements}
          user={user}
          onMovementDeleted={handleMovementDeleted}
        />
      )
    }
  ];

  if (loading) {
    return (
      <div className="passport-loading">
        <div className="loading-spinner" />
        <p>Loading passport tracking data...</p>
      </div>
    );
  }

  return (
    <div className="candidate-passport-container">
      
            <div className="info-badges">
              {candidateData?.passportNo && (
                <span className="info-badge">
                  🛂 {candidateData.passportNo}
                </span>
              )}
              {existingMovements.receive && (
                <span className="status-badge received">
                  📥 Received
                </span>
              )}
              {existingMovements.send && (
                <span className="status-badge sent">
                  📤 Sent
                </span>
              )}
            
      </div>

      {/* Tabs */}
      <Tabs
        defaultActiveTab={activeTab}
        tabs={tabs}
        onTabChange={setActiveTab}
      />
    </div>
  );
}

export default CandidatePassport;
