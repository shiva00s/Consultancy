import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../css/CommunicationHistory.css';

const CommunicationHistory = ({ candidateId }) => {
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    candidateId: candidateId || null,
    type: 'all',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  const observerTarget = useRef(null);
  const limit = 50;

  // Fetch communications with filters
  const fetchCommunications = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const currentOffset = reset ? 0 : offset;
      
      const result = await window.electronAPI.getCommunicationLogs({
        ...filters,
        limit,
        offset: currentOffset
      });

      if (result.success) {
        setCommunications(prev => 
          reset ? result.data : [...prev, ...result.data]
        );
        setHasMore(result.hasMore || false);
        setOffset(currentOffset + limit);
      } else {
        console.error('Failed to fetch communications:', result.error);
      }
    } catch (error) {
      console.error('Error fetching communications:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, offset, loading]);

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const result = await window.electronAPI.getCommunicationLogs({
        candidateId: candidateId || null,
        type: 'all',
        limit: 10000,
        offset: 0
      });
      
      if (result.success) {
        const data = result.data || [];
        const stats = {
          total: data.length,
          whatsapp: data.filter(c => c.type === 'whatsapp').length,
          calls: data.filter(c => c.type === 'call').length,
          emails: data.filter(c => c.type === 'email').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Update filters when candidateId prop changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, candidateId: candidateId || null }));
  }, [candidateId]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchCommunications(true);
  }, []);

  // Reload when filters change
  useEffect(() => {
    setOffset(0);
    setCommunications([]);
    fetchCommunications(true);
  }, [filters.candidateId, filters.type, filters.startDate, filters.endDate]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchCommunications();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, fetchCommunications]);

  // Export functionality
  const handleExport = async () => {
    try {
      const result = await window.electronAPI.getCommunicationLogs({
        ...filters,
        limit: 100000,
        offset: 0
      });

      if (result.success && result.data) {
        const headers = ['ID', 'Date', 'Time', 'Candidate', 'Phone', 'Type', 'Direction', 'Message', 'Status'];
        const rows = result.data.map(comm => {
          const date = new Date(comm.timestamp);
          return [
            comm.id,
            date.toLocaleDateString('en-IN'),
            date.toLocaleTimeString('en-IN'),
            comm.candidatename || 'Unknown',
            comm.phonenumber || 'N/A',
            comm.type,
            comm.direction || 'N/A',
            (comm.message || '').replace(/"/g, '""'),
            comm.status || 'completed'
          ];
        });

        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `communications_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Communications exported successfully!');
      } else {
        alert(`Export failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Check console for details.');
    }
  };

  // Filter handlers
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      candidateId: candidateId || null,
      type: 'all',
      startDate: '',
      endDate: '',
      searchTerm: ''
    });
  };

  // Search filter (client-side)
  const filteredCommunications = communications.filter(comm => {
    if (!filters.searchTerm) return true;
    const searchLower = filters.searchTerm.toLowerCase();
    return (
      comm.candidatename?.toLowerCase().includes(searchLower) ||
      comm.phonenumber?.includes(searchLower) ||
      comm.message?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTypeIcon = (type) => {
    switch(type?.toLowerCase()) {
      case 'whatsapp': return '💬';
      case 'call': return '📞';
      case 'email': return '✉️';
      case 'meeting': return '🤝';
      default: return '📝';
    }
  };

  const getTypeColor = (type) => {
    switch(type?.toLowerCase()) {
      case 'whatsapp': return '#25D366';
      case 'call': return '#4A90E2';
      case 'email': return '#EA4335';
      case 'meeting': return '#FBBC05';
      default: return '#999';
    }
  };

  return (
    <div className="communication-history-container">
      {/* Header Section */}
      <div className="comm-header">
        <div className="comm-title-section">
          <h2>📞 Communication History</h2>
          <p className="comm-subtitle">
            {candidateId ? 'Candidate communications' : 'Track all candidate communications in one place'}
          </p>
        </div>
        
        <button className="export-btn" onClick={handleExport}>
          📥 Export to CSV
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="comm-stats-grid">
          <div className="stat-card">
            <div className="stat-icon total">📊</div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Communications</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon whatsapp">💬</div>
            <div className="stat-content">
              <div className="stat-value">{stats.whatsapp}</div>
              <div className="stat-label">WhatsApp Messages</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon calls">📞</div>
            <div className="stat-content">
              <div className="stat-value">{stats.calls}</div>
              <div className="stat-label">Phone Calls</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon emails">✉️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.emails}</div>
              <div className="stat-label">Emails</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div className="comm-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>🔍 Search</label>
            <input
              type="text"
              placeholder="Search by name, phone, or message..."
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="filter-input search-input"
            />
          </div>

          <div className="filter-group">
            <label>📋 Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Types</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="call">Phone Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="filter-group">
            <label>📅 From Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>📅 To Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="filter-input"
            />
          </div>

          <button 
            className="clear-filters-btn" 
            onClick={handleClearFilters}
            title="Clear all filters"
          >
            🔄 Clear
          </button>
        </div>
      </div>

      {/* Communications Timeline */}
      <div className="comm-timeline">
        {filteredCommunications.length === 0 && !loading ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No Communications Found</h3>
            <p>Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          filteredCommunications.map((comm, index) => (
            <div key={comm.id || index} className="comm-timeline-item">
              <div 
                className="comm-timeline-marker"
                style={{ borderColor: getTypeColor(comm.type) }}
              >
                <span className="comm-type-icon">{getTypeIcon(comm.type)}</span>
              </div>
              
              <div className="comm-timeline-content">
                <div className="comm-card">
                  <div className="comm-card-header">
                    <div className="comm-meta-left">
                      <span 
                        className="comm-type-badge"
                        style={{ background: getTypeColor(comm.type) }}
                      >
                        {(comm.type || 'OTHER').toUpperCase()}
                      </span>
                      <span className="comm-candidate-name">
                        {comm.candidatename || 'Unknown'}
                      </span>
                      {comm.phonenumber && (
                        <span className="comm-phone">📱 {comm.phonenumber}</span>
                      )}
                      {comm.direction && (
                        <span className={`comm-direction ${comm.direction}`}>
                          {comm.direction === 'inbound' ? '↓' : '↑'} {comm.direction}
                        </span>
                      )}
                    </div>
                    
                    <div className="comm-meta-right">
                      <span className="comm-date">{formatDate(comm.timestamp)}</span>
                      <span className="comm-time">{formatTime(comm.timestamp)}</span>
                      <span className={`comm-status status-${comm.status || 'completed'}`}>
                        {comm.status || 'completed'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="comm-card-body">
                    <p className="comm-message">{comm.message || comm.details || 'No message'}</p>
                    
                    {comm.media && (
                      <div className="comm-media-indicator">
                        📎 {comm.media.type || 'Attachment'}
                      </div>
                    )}
                    
                    {comm.username && (
                      <div className="comm-user-tag">
                        By: {comm.username}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Infinite Scroll Trigger */}
        {hasMore && (
          <div ref={observerTarget} className="scroll-trigger">
            {loading && (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <span>Loading more communications...</span>
              </div>
            )}
          </div>
        )}
        
        {!hasMore && communications.length > 0 && (
          <div className="end-of-list">
            <span>🎉 You've reached the end!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunicationHistory;
