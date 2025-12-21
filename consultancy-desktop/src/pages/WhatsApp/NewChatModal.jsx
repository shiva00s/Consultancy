// src/pages/WhatsApp/NewChatModal.jsx

import { useState, useEffect } from 'react';
import { X, Search, User, Phone } from 'lucide-react';
import './NewChatModal.css';

const NewChatModal = ({ onClose, onSelect }) => {
  const [candidates, setCandidates] = useState([]); // ✅ Initialized as array
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      
      const response = await window.electronAPI.whatsapp.getCandidatesWithPhone();
      
      try {
        console.log('Candidates response (raw):', response, JSON.stringify(response));
      } catch (e) {
        console.log('Candidates response (raw, non-serializable):', response);
      }

      // Tolerant handling: accept either an array, or { success, data } shape.
      let candidatesData = [];
      if (Array.isArray(response)) {
        candidatesData = response;
      } else if (response && Array.isArray(response.data)) {
        candidatesData = response.data;
      } else if (response && response.success && !response.data) {
        // success but no data property (defensive)
        candidatesData = [];
      } else {
        console.error('Failed to load candidates, unexpected response shape:', response);
        candidatesData = [];
      }

      setCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      console.log(`Loaded ${candidatesData.length} candidates with phone numbers`);
    } catch (error) {
      console.error('Error loading candidates:', error);
      setCandidates([]); // ✅ Ensure array
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Add safety check before filter
  const filteredCandidates = Array.isArray(candidates) 
    ? candidates.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contact?.includes(searchTerm)
      )
    : []; // ✅ Return empty array if candidates is not an array

  const handleSelect = async (candidate) => {
    try {
      console.log('Creating conversation for', candidate);
      
      const response = await window.electronAPI.whatsapp.createConversation({
        candidateId: candidate.id,
        phoneNumber: candidate.contact,
        candidateName: candidate.name
      });
      
      console.log('Create conversation response:', response);
      
      if (response?.success) {
        const conversationData = {
          id: response.conversationId || response.data?.id,
          candidate_id: candidate.id,
          candidate_name: candidate.name,
          phone_number: candidate.contact,
          ...response.data
        };
        
        console.log('Conversation created:', conversationData);
        onSelect(conversationData);
        onClose();
      } else {
        console.error('Failed to create conversation:', response?.error);
        alert(`Failed to create conversation: ${response?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert(`Error creating conversation: ${error.message}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>💬 Start New Conversation</h3>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="candidates-list">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading candidates...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="empty-state">
              <User size={48} className="empty-icon" />
              <p className="empty-title">No candidates found</p>
              <p className="empty-subtitle">
                {searchTerm 
                  ? 'Try a different search term' 
                  : candidates.length === 0 
                    ? 'Add candidates with phone numbers to start chatting'
                    : 'No candidates match your search'}
              </p>
            </div>
          ) : (
            filteredCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="candidate-item"
                onClick={() => handleSelect(candidate)}
              >
                <div className="candidate-avatar">
                  <User size={20} />
                </div>
                <div className="candidate-details">
                  <h4>{candidate.name}</h4>
                  <div className="candidate-info">
                    <Phone size={14} />
                    <span>{candidate.contact}</span>
                  </div>
                  {candidate.position && (
                    <p className="candidate-position">{candidate.position}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {!loading && candidates.length > 0 && (
          <div className="modal-footer">
            <span className="result-count">
              {filteredCandidates.length} of {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewChatModal;
