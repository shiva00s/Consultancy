import { useState, useEffect } from 'react';

export function useJobOrderPositions() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPositions = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all job orders from database
        const response = await window.electronAPI.getJobOrders();

        if (response.success && response.data) {
          // Extract unique positions
          const uniquePositions = [
            ...new Set(
              response.data
                .map((job) => job.position || job.positionTitle)
                .filter((pos) => pos && pos.trim() !== '')
            ),
          ].sort();

          setPositions(uniquePositions);
        } else {
          throw new Error(response.error || 'Failed to fetch job orders');
        }
      } catch (err) {
        console.error('Error fetching job order positions:', err);
        setError(err.message);
        // Fallback to default positions
        setPositions(['Welder', 'Electrician', 'Plumber', 'Driver']);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, []);

  return { positions, loading, error };
}
