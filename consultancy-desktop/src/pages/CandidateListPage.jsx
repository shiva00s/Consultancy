import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiSearch, FiEdit, FiUser, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/CandidateListPage.css';
import LazyRemoteImage from '../components/common/LazyRemoteImage';
import { useJobOrderPositions } from '../hooks/useJobOrderPositions';

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

// Helper Component for Highlighting Search Terms
const HighlightText = ({ text, highlight }) => {
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
};

function CandidateListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Use custom hook for positions
  const { positions: positionOptions, loading: loadingPositions, error: positionsError } = useJobOrderPositions();

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

  // photoCache remains available for other consumers; images are now lazily loaded per-item

  // Search Function
  const runSearch = async (page, term, status, position) => {
    setLoading(true);
    setCurrentPage(page);
    const limit = ITEMS_PER_PAGE;
    const offset = (page - 1) * limit;

    try {
      const res = await window.electronAPI.searchCandidates({
        searchTerm: term,
        status: status,
        position: position,
        limit: limit,
        offset: offset,
      });

        if (res.success) {
        setResults(res.data);
        setTotalItems(res.totalCount);
      } else {
        toast.error(`Error searching: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Lifecycle: Handle URL Params
  useEffect(() => {
    const queryTerm = searchParams.get('q') || '';
    const queryStatus = searchParams.get('status') || '';
    const queryPosition = searchParams.get('position') || '';
    
    setSearchTerm(queryTerm);
    setStatusFilter(queryStatus);
    setPositionFilter(queryPosition);
    
    runSearch(1, queryTerm, queryStatus, queryPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Show error toast if positions failed to load
  useEffect(() => {
    if (positionsError) {
      toast.error('Failed to load positions, using defaults');
    }
  }, [positionsError]);

  // Handlers
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = {};
    if (searchTerm) params.q = searchTerm;
    if (statusFilter) params.status = statusFilter;
    if (positionFilter) params.position = positionFilter;
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPositionFilter('');
    setSearchParams({});
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      runSearch(newPage, searchTerm, statusFilter, positionFilter);
    }
  };

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
        <div className="results-header">
          {totalItems > 0
            ? `Found ${totalItems} candidate${totalItems > 1 ? 's' : ''}`
            : 'No candidates found'}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner">⏳ Loading...</div>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No candidates found. Try adjusting your filters.
          </div>
        ) : (
          <div className="results-list">
            {results.map((candidate) => (
              <div
                key={candidate.id}
                className="result-card"
                onClick={() => navigate(`/candidate/${candidate.id}`)}
              >
                {/* Photo / Icon */}
                <div className="result-card-icon">
                  <LazyRemoteImage
                    filePath={candidate.photo_path || candidate.photoPath}
                    placeholder={<FiUser />}
                    className="candidate-photo"
                    onLoad={(dataUrl) => setPhotoCache((prev) => ({ ...prev, [candidate.id]: dataUrl }))}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/candidate/${candidate.id}`);
                    }}
                  >
                    <FiEdit size={14} />
                    View / Edit
                  </button>
                </div>
              </div>
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
