import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiSearch, FiEdit, FiUser, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/CandidateListPage.css';
import LazyRemoteImage from '../components/common/LazyRemoteImage';
import { useJobOrderPositions } from '../hooks/useJobOrderPositions';
import useDataStore from '../store/dataStore';
import { useRef } from 'react';

const statusOptions = [
  'Pending/New',
  'Documents Submitted',
  'Biometrics Done',
  'Visa Applied',
  'In Progress',
  'Approved',
  'Rejected',
  'Cancelled',
];

const ITEMS_PER_PAGE = 20;

const getStatusClass = (status) => {
  switch (status) {
    case 'New':
      return 'badge-cyan';
    case 'Documents Collected':
      return 'badge-yellow';
    case 'Visa Applied':
      return 'badge-blue';
    case 'In Progress':
      return 'badge-purple';
    case 'Completed':
      return 'badge-green';
    case 'Rejected':
      return 'badge-red';
    default:
      return 'badge-grey';
  }
};

// Helper Component for Highlighting Search Terms - Memoized
const HighlightText = React.memo(({ text, highlight }) => {
  if (!highlight || !text) return <>{text}</>;
  const safeHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.toString().split(new RegExp(`(${safeHighlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
});

// Memoized Candidate Card Component - Prevents unnecessary re-renders
const CandidateCard = React.memo(({ 
  candidate, 
  searchTerm, 
  onNavigate, 
  onPhotoLoad 
}) => {
  const handleCardClick = useCallback(() => {
    onNavigate(candidate.id);
  }, [candidate.id, onNavigate]);

  const handleButtonClick = useCallback((e) => {
    e.stopPropagation();
    onNavigate(candidate.id);
  }, [candidate.id, onNavigate]);

  const handlePhotoLoadCallback = useCallback((dataUrl) => {
    onPhotoLoad(candidate.id, dataUrl);
  }, [candidate.id, onPhotoLoad]);

  return (
    <div className="result-card" onClick={handleCardClick}>
      {/* Photo / Icon */}
      <div className="result-card-icon">
        <LazyRemoteImage
          filePath={candidate.photo_path || candidate.photoPath}
          placeholder={<FiUser />}
          className="candidate-photo"
          onLoad={handlePhotoLoadCallback}
        />
      </div>

      {/* Candidate Info */}
      <div className="result-card-info">
        <h3>
          <span className="candidate-emoji">👤</span>
          <HighlightText text={candidate.name} highlight={searchTerm} />
        </h3>
        <p>
          💼 <strong>Position:</strong>{' '}
          <HighlightText
            text={candidate.Position || 'Not Specified'}
            highlight={searchTerm}
          />
        </p>
        <p>
          🛂 <strong>Passport:</strong>{' '}
          <HighlightText
            text={candidate.passportNo || 'N/A'}
            highlight={searchTerm}
          />
        </p>
        <p>
          📱 <strong>Contact:</strong>{' '}
          <HighlightText
            text={candidate.contact || 'N/A'}
            highlight={searchTerm}
          />
        </p>
      </div>

      {/* Status & Button */}
      <div className="result-card-status">
        <span className={`badge ${getStatusClass(candidate.status)}`}>
          {candidate.status || 'Unknown'}
        </span>
        <button
          className="btn btn-primary"
          onClick={handleButtonClick}
        >
          <FiEdit size={14} />
          View / Edit
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these change
  return (
    prevProps.candidate.id === nextProps.candidate.id &&
    prevProps.searchTerm === nextProps.searchTerm &&
    prevProps.candidate.photo_path === nextProps.candidate.photo_path &&
    prevProps.candidate.photoPath === nextProps.candidate.photoPath &&
    prevProps.candidate.status === nextProps.candidate.status
  );
});

function CandidateListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Use custom hook for positions
  const { positions: positionOptions, loading: loadingPositions, error: positionsError } = useJobOrderPositions();

  // Data store hooks (must be top-level)
  const getCandidatesPage = useDataStore(state => state.getCandidatesPage);
  const fetchCandidatesPage = useDataStore(state => state.fetchCandidatesPage);
  const storeCandidatesTotal = useDataStore(state => state.candidatesTotal);

  // Local State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [photoCache, setPhotoCache] = useState({});
  
  // Refs for performance optimization
  const searchInProgressRef = useRef(false);
  const lastSearchRef = useRef({ page: null, term: null, status: null, position: null });
  const searchTimeoutRef = useRef(null);

  // Memoized calculations
  const totalPages = useMemo(() => Math.ceil(totalItems / ITEMS_PER_PAGE), [totalItems]);

  // Memoized callback for photo cache updates
  const handlePhotoLoad = useCallback((candidateId, dataUrl) => {
    setPhotoCache((prev) => {
      // Don't update if already cached (prevents unnecessary re-renders)
      if (prev[candidateId] === dataUrl) return prev;
      return { ...prev, [candidateId]: dataUrl };
    });
  }, []);

  // Memoized navigation handler
  const handleNavigate = useCallback((candidateId) => {
    navigate(`/candidate/${candidateId}`);
  }, [navigate]);

  // Optimized Search Function with debouncing capability
  const runSearch = useCallback(async (page, term, status, position) => {
    // Prevent re-entrant searches
    if (searchInProgressRef.current) return;
    
    // Avoid repeating identical search
    if (
      lastSearchRef.current.page === page &&
      lastSearchRef.current.term === term &&
      lastSearchRef.current.status === status &&
      lastSearchRef.current.position === position
    ) {
      return;
    }

    searchInProgressRef.current = true;
    setLoading(true);
    if (currentPage !== page) setCurrentPage(page);
    
    const limit = ITEMS_PER_PAGE;
    const offset = (page - 1) * limit;
    
    try {
      const isFiltered = !!(term || status || position);

      // Check cache only for non-filtered searches
      if (!isFiltered) {
        const cached = getCandidatesPage(page);
        if (cached) {
          setResults(cached);
          setTotalItems(storeCandidatesTotal || cached.length);
          lastSearchRef.current = { page, term, status, position };
          setLoading(false);
          searchInProgressRef.current = false;
          return;
        }
      }

      // Fetch from backend
      const res = await fetchCandidatesPage({ 
        page, 
        searchTerm: term, 
        status, 
        position, 
        pageSize: limit 
      });
      
      if (res.success) {
        setResults(res.data);
        setTotalItems(res.totalCount);
        lastSearchRef.current = { page, term, status, position };
      } else {
        toast.error(`Error searching: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Search failed');
    } finally {
      setLoading(false);
      searchInProgressRef.current = false;
    }
  }, [currentPage, getCandidatesPage, fetchCandidatesPage, storeCandidatesTotal]);

  // Debounced search trigger for manual input changes
  const triggerDebouncedSearch = useCallback((page, term, status, position) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search (300ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      runSearch(page, term, status, position);
    }, 300);
  }, [runSearch]);

  // Lifecycle: Handle URL Params (only runs when URL changes)
  useEffect(() => {
    const queryTerm = searchParams.get('q') || '';
    const queryStatus = searchParams.get('status') || '';
    const queryPosition = searchParams.get('position') || '';
    
    setSearchTerm(queryTerm);
    setStatusFilter(queryStatus);
    setPositionFilter(queryPosition);
    
    // Immediate search when URL changes
    runSearch(1, queryTerm, queryStatus, queryPosition);
  }, [searchParams, runSearch]);

  // Show error toast if positions failed to load
  useEffect(() => {
    if (positionsError) {
      toast.error('Failed to load positions, using defaults');
    }
  }, [positionsError]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Memoized Handlers
  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault();
    
    // Clear any pending debounced search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    const params = {};
    if (searchTerm) params.q = searchTerm;
    if (statusFilter) params.status = statusFilter;
    if (positionFilter) params.position = positionFilter;
    setSearchParams(params);
  }, [searchTerm, statusFilter, positionFilter, setSearchParams]);

  const clearFilters = useCallback(() => {
    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    setSearchTerm('');
    setStatusFilter('');
    setPositionFilter('');
    setSearchParams({});
  }, [setSearchParams]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      runSearch(newPage, searchTerm, statusFilter, positionFilter);
    }
  }, [totalPages, runSearch, searchTerm, statusFilter, positionFilter]);

  // Memoized skeleton loader
  const skeletonLoader = useMemo(() => (
    <div className="skeleton-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line short" />
            <div className="skeleton-line" />
            <div className="skeleton-line long" />
          </div>
          <div className="skeleton-badge" />
        </div>
      ))}
    </div>
  ), []);

  // Memoized results header
  const resultsHeader = useMemo(() => (
    <div className="results-header">
      {totalItems > 0
        ? `Found ${totalItems} candidate${totalItems > 1 ? 's' : ''}`
        : 'No candidates found'}
    </div>
  ), [totalItems]);

  return (
    <div className="list-page-container">
      {/* Search Bar */}
      <form className="search-bar" onSubmit={handleSearchSubmit}>
        <div className="search-field">
          <FiSearch />
          <input
            type="text"
            placeholder="🔍 Search by name, passport, contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">📋 All Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          disabled={loadingPositions}
        >
          <option value="">💼 All Positions</option>
          {loadingPositions ? (
            <option disabled>Loading positions...</option>
          ) : positionOptions.length === 0 ? (
            <option disabled>No positions available</option>
          ) : (
            positionOptions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))
          )}
        </select>

        <button type="submit" className="btn btn-primary">
          🔍 Search
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={clearFilters}
        >
          ✖️ Clear
        </button>
      </form>

      {/* Results */}
      <div className="results-container">
        {resultsHeader}

        {loading ? (
          skeletonLoader
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No candidates found. Try adjusting your filters.
          </div>
        ) : (
          <div className="results-list">
            {results.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                searchTerm={searchTerm}
                onNavigate={handleNavigate}
                onPhotoLoad={handlePhotoLoad}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="btn btn-secondary"
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            <FiChevronLeft />
            Previous
          </button>

          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="btn btn-secondary"
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
            <FiChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}

export default CandidateListPage;
