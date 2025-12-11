import React from 'react';
import '../css/LoadingSpinner.css';

export const LoadingSpinner = ({ size = 'medium', fullScreen = false }) => {
  const sizeClass = `spinner-${size}`;
  
  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        <div className={`spinner ${sizeClass}`}></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  return <div className={`spinner ${sizeClass}`}></div>;
};

export const LoadingSkeleton = ({ width = '100%', height = '20px', count = 1 }) => {
  return (
    <div className="skeleton-wrapper">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{ width, height, marginBottom: '8px' }}
        ></div>
      ))}
    </div>
  );
};

export const CardSkeleton = () => {
  return (
    <div className="card-skeleton">
      <LoadingSkeleton width="60%" height="24px" />
      <LoadingSkeleton width="100%" height="16px" count={3} />
      <LoadingSkeleton width="40%" height="16px" />
    </div>
  );
};

export const TableSkeleton = ({ rows = 5, columns = 5 }) => {
  return (
    <div className="table-skeleton">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="table-skeleton-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <LoadingSkeleton key={colIndex} width="90%" height="16px" />
          ))}
        </div>
      ))}
    </div>
  );
};
export default {
  LoadingSpinner,
  LoadingSkeleton,
  CardSkeleton,
  TableSkeleton,
};