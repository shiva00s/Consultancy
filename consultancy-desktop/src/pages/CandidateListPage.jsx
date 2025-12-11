import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiSearch, FiEdit, FiUser, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/CandidateListPage.css';


const statusOptions = [
  'New', 'Documents Collected', 'Visa Applied', 'In Progress', 'Completed', 'Rejected',
];

const ITEMS_PER_PAGE = 20;

const getStatusClass = (status) => {
  switch (status) {
    case 'New': return 'badge-cyan';
    case 'Documents Collected': return 'badge-yellow';
    case 'Visa Applied': return 'badge-blue';
    case 'In Progress': return 'badge-purple';
    case 'Completed': return 'badge-green';
    case 'Rejected': return 'badge-red';
    default: return 'badge-grey';
  }
};

// [FIX] New Helper Component for Highlighting Search Terms
const HighlightText = ({ text, highlight }) => {
  if (!highlight || !text) return <span>{text}</span>;
  
  // Escape regex special characters to prevent crashes (e.g. searching for "+")
  const safeHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.toString().split(new RegExp(`(${safeHighlight})`, 'gi'));
  
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? 
        <span key={i} style={{ 
            backgroundColor: '#fff3cd', 
            color: '#000', // Force black text for contrast against yellow
            fontWeight: 'bold',
            borderRadius: '2px',
            padding: '0 2px'
        }}>
            {part}
        </span> : 
        part
      )}
    </span>
  );
};

function CandidateListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Local State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState(''); 
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [photoCache, setPhotoCache] = useState({});
  
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // --- Image Fetcher ---
  const fetchPhotos = async (candidates) => {
    const pathsToFetch = candidates
        .filter(c => c.photoPath && !photoCache[c.id])
        .map(c => ({ id: c.id, path: c.photoPath }));

    if (pathsToFetch.length === 0) return;

    const promises = pathsToFetch.map(async ({ id, path }) => {
        const res = await window.electronAPI.getImageBase64({ filePath: path });
        return { id, data: res.success ? res.data : null };
    });

    const results = await Promise.all(promises);

    setPhotoCache(prev => {
        const newCache = { ...prev };
        results.forEach(item => {
            if (item.data) newCache[item.id] = item.data;
        });
        return newCache;
    });
  };

  // --- 1. Search Function ---
  const runSearch = async (page, term, status) => {
    setLoading(true);
    setCurrentPage(page);

    const limit = ITEMS_PER_PAGE;
    const offset = (page - 1) * limit;

    try {
        const res = await window.electronAPI.searchCandidates({ 
          searchTerm: term,
          status: status,
          position: positionFilter, 
          limit: limit,
          offset: offset,
        });
        
        if (res.success) {
          setResults(res.data);
          setTotalItems(res.totalCount);
          fetchPhotos(res.data);
        } else {
          toast.error(`Error searching: ${res.error}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  // --- 2. Lifecycle: Handle URL Params (Navigation / Drill-down) ---
  useEffect(() => {
    // This ONLY runs when the URL changes (e.g. Dashboard click or Search Button click)
    // It does NOT run when typing in the input box.
    const queryTerm = searchParams.get('q') || '';
    const queryStatus = searchParams.get('status') || '';

    setSearchTerm(queryTerm);
    setStatusFilter(queryStatus);

    runSearch(1, queryTerm, queryStatus);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); 

  // --- 3. Handlers ---
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // Pushing to URL triggers the useEffect above
    setSearchParams({ q: searchTerm, status: statusFilter });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPositionFilter('');
    setSearchParams({}); // Triggers reset via useEffect
  };
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      // For pagination, we use current local state
      runSearch(newPage, searchTerm, statusFilter);
    }
  };

  return (
    <div className="list-page-container">
      <h1>Search Candidates</h1>
      
      <form className="search-bar" onSubmit={handleSearchSubmit}>
        <div className="search-field">
          <FiSearch />
          <input
            type="text"
            placeholder="Search by Name, Passport No, Contact, or Aadhar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <select 
            value={statusFilter} 
            onChange={(e) => {
                const newStatus = e.target.value;
                setStatusFilter(newStatus);
                // 🐞 FIX: Removed redundant runSearch call here. Rely on form submit.
                // setTimeout(() => {
                //     runSearch(1, searchTerm, newStatus);
                // }, 100);
            }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={loading}>
          Clear
        </button>
      </form>

      <div className="results-container">
        <div className="results-header">
          Found {totalItems} candidate(s) (Page {currentPage} of {totalPages})
        </div>
        
        <div className="results-list">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '20px' }}>Loading...</p>
          ) : results.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px' }}>No candidates found.</p>
          ) : (
            results.map((candidate) => (
              <div
                key={candidate.id}
                className="result-card"
                onClick={() => navigate(`/candidate/${candidate.id}`)}
              >
                <div className="result-card-icon">
                  {photoCache[candidate.id] ? (
                    <img src={photoCache[candidate.id]} alt={candidate.name} className="candidate-photo" />
                  ) : (
                    <FiUser />
                  )}
                </div>
                <div className="result-card-info">
                  {/* [FIX] Apply Highlighting Here */}
                  <h3><HighlightText text={candidate.name} highlight={searchTerm} /></h3>
                  <p><strong>Position:</strong> <HighlightText text={candidate.Position || 'N/A'} highlight={searchTerm} /></p>
                  <p><strong>Passport:</strong> <HighlightText text={candidate.passportNo || 'N/A'} highlight={searchTerm} /></p>
                  <p><strong>Contact:</strong> <HighlightText text={candidate.contact || 'N/A'} highlight={searchTerm} /></p>
                </div>
                <div className="result-card-status"> 
                  <span className={`status-badge ${getStatusClass(candidate.status)}`}>
                    {candidate.status}
                  </span>
                  <button 
                    className="doc-btn view" 
                    title="View / Edit"
                    style={{width: '36px', height: '36px'}}
                    onClick={(e) => {
                        e.stopPropagation(); 
                        navigate(`/candidate/${candidate.id}`);
                    }}
                  >
                    <FiEdit />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {totalItems > ITEMS_PER_PAGE && (
        <div className="pagination-controls">
          <button 
            className="btn btn-secondary"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
          >
            <FiChevronLeft /> Previous
          </button>
          <span className="pagination-info">Page {currentPage} of {totalPages}</span>
          <button 
            className="btn btn-secondary"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
          >
            Next <FiChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}

export default CandidateListPage;