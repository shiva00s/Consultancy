import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// ===== CANDIDATE QUERIES =====

/**
 * Fetch all candidates with filters
 */
export const useCandidates = (filters = {}) => {
  return useQuery({
    queryKey: ['candidates', filters],
    queryFn: async () => {
      const result = await window.electronAPI.searchCandidates({
        searchTerm: filters.searchTerm || '',
        status: filters.status || '',
        position: filters.position || '',
        limit: filters.limit || 20,
        offset: filters.offset || 0,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch candidates');
      }

      return {
        candidates: result.data,
        totalCount: result.totalCount,
      };
    },
    enabled: true,
    keepPreviousData: true, // Keep old data while fetching new
  });
};

/**
 * Fetch single candidate details
 */
export const useCandidateDetails = (candidateId) => {
  return useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: async () => {
      const result = await window.electronAPI.getCandidateDetails({ 
        id: candidateId 
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch candidate details');
      }

      return result.data;
    },
    enabled: !!candidateId,
    staleTime: 2 * 60 * 1000, // 2 minutes for frequently updated data
  });
};

/**
 * Fetch candidate documents
 */
export const useCandidateDocuments = (candidateId) => {
  return useQuery({
    queryKey: ['candidate', candidateId, 'documents'],
    queryFn: async () => {
      const result = await window.electronAPI.getCandidateDocuments({ 
        candidateId 
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      return result.documents;
    },
    enabled: !!candidateId,
  });
};

/**
 * Fetch candidate placements
 */
export const useCandidatePlacements = (candidateId) => {
  return useQuery({
    queryKey: ['candidate', candidateId, 'placements'],
    queryFn: async () => {
      const result = await window.electronAPI.getCandidatePlacements({ 
        candidateId 
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch placements');
      }

      return result.data;
    },
    enabled: !!candidateId,
  });
};

// ===== CANDIDATE MUTATIONS =====

/**
 * Create new candidate
 */
export const useCreateCandidate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (candidateData) => {
      const result = await window.electronAPI.saveCandidateMulti(candidateData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create candidate');
      }

      return result;
    },
    onSuccess: (data) => {
      // Invalidate candidates list to refetch
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success(`Candidate created successfully! ID: ${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create candidate: ${error.message}`);
    },
  });
};

/**
 * Update candidate
 */
export const useUpdateCandidate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data, user }) => {
      const result = await window.electronAPI.updateCandidateText({
        user,
        id,
        data,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update candidate');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate specific candidate and list
      queryClient.invalidateQueries({ queryKey: ['candidate', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate updated successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
};

/**
 * Delete candidate
 */
export const useDeleteCandidate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, user }) => {
      const result = await window.electronAPI.deleteCandidate({ user, id });

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete candidate');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate moved to recycle bin');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
};

// ===== EMPLOYER QUERIES =====

export const useEmployers = () => {
  return useQuery({
    queryKey: ['employers'],
    queryFn: async () => {
      const result = await window.electronAPI.getAllEmployers();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch employers');
      }

      return result.data;
    },
  });
};

// ===== JOB QUERIES =====

export const useJobs = (filters = {}) => {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const result = await window.electronAPI.getAllJobs(filters);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch jobs');
      }

      return result.data;
    },
    keepPreviousData: true,
  });
};

// ===== DASHBOARD STATISTICS =====

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const result = await window.electronAPI.getDashboardStats();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stats');
      }

      return result.data;
    },
    refetchInterval: 60000, // Auto-refetch every minute
  });
};

// ===== NOTIFICATIONS =====

export const useNotifications = (limit = 50) => {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const result = await window.electronAPI.getNotifications({ limit });

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch notifications');
      }

      return result.notifications;
    },
    refetchInterval: 30000, // Auto-refetch every 30 seconds
  });
};

// ===== PREFETCH UTILITIES =====

/**
 * Prefetch candidate details on hover
 */
export const usePrefetchCandidate = () => {
  const queryClient = useQueryClient();

  return (candidateId) => {
    queryClient.prefetchQuery({
      queryKey: ['candidate', candidateId],
      queryFn: async () => {
        const result = await window.electronAPI.getCandidateDetails({ 
          id: candidateId 
        });
        return result.data;
      },
      staleTime: 2 * 60 * 1000,
    });
  };
};
// Phone number: E.164 format