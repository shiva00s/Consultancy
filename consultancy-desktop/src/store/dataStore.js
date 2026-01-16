import { create } from 'zustand';
import toast from 'react-hot-toast';

// Define the store structure
const useDataStore = create((set, get) => ({
  employers: [],
  jobs: [],
  candidatesSummary: [],
  candidatesPages: {}, // { pageNumber: [candidates] }
  candidatesTotal: 0,
  candidatesPageSize: 20,
  isLoaded: false,
  isLoading: false, // ✅ Added to prevent double-fetch
  error: null,

  // --- ACTIONS ---

  // 1. Fetch all data from the database
  fetchInitialData: async () => {
    // ✅ Prevent multiple simultaneous fetches
    const state = get();
    // Use an immediate check against isLoading flag
    if (state.isLoading || state.isLoaded) { 
      console.log('Data already loaded or loading, skipping fetch.');
      return;
    }  

    set({ isLoading: true, error: null });

    try {
      const [empRes, jobRes] = await Promise.all([
        window.electronAPI.getEmployers(),
        window.electronAPI.getJobOrders(),
      ]);

      if (empRes.success && jobRes.success) {
        // MODIFIED: Use functional update to ensure state consistency
        set(state => ({
          ...state,
          employers: empRes.data,
          jobs: jobRes.data,
          // preload a modest candidates summary (first N)
          candidatesSummary: state.candidatesSummary || [],
          isLoaded: true,
          isLoading: false,
        }));
        console.log("Zustand Store: Initial data loaded successfully.");
        // Kick off background preload of candidate summaries (best-effort)
        try {
          const pageSize = 20;
          const limit = 500; // fetch up to 500 candidate summaries for quick browsing
          const resp = await window.electronAPI.searchCandidates({ searchTerm: '', status: '', position: '', limit, offset: 0 });
          if (resp && resp.success) {
            const list = resp.data || [];
            // build pages
            const pages = {};
            for (let i = 0; i < list.length; i++) {
              const p = Math.floor(i / pageSize) + 1;
              pages[p] = pages[p] || [];
              pages[p].push(list[i]);
            }
            set({ candidatesSummary: list, candidatesPages: pages, candidatesTotal: resp.totalCount || list.length, candidatesPageSize: pageSize });
            console.log('Zustand Store: Candidate summaries preloaded', list.length);
            // Background prefetch thumbnails to disk (best-effort, non-blocking)
            (async function prefetchThumbnails(items) {
              const concurrency = 4;
              let idx = 0;
              const worker = async () => {
                while (idx < items.length) {
                  const i = idx++;
                  const it = items[i];
                  try {
                    const photo = it.photo_path || it.photoPath;
                    if (photo) {
                      // fire-and-forget: ask main process to create a disk cached thumbnail
                      window.electronAPI.getImageBase64({ filePath: photo, maxWidth: 128, maxHeight: 128, diskCache: true }).catch(()=>{});
                    }
                  } catch (e) {
                    // swallow errors to avoid spamming logs
                  }
                }
              };
              // Start workers with small delay to avoid blocking CPU on startup
              for (let w = 0; w < concurrency; w++) setTimeout(worker, 50 * w);
            })(list);
          }
        } catch (e) {
          console.warn('Candidate preload failed', e);
        }
      } else {
        const errorMsg = empRes.error || jobRes.error || 'Failed to load initial data.';
        set({ error: errorMsg, isLoaded: true, isLoading: false });
        toast.error(`Store Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
      set({ error: err.message, isLoaded: false, isLoading: false });
      toast.error('Failed to load data');
    }
  },

  // ✅ Reset function for logout
  reset: () => set({
    employers: [],
    jobs: [],
    candidatesSummary: [],
    candidatesPages: {},
    candidatesTotal: 0,
    isLoaded: false,
    isLoading: false,
    error: null,
  }),

  // 2. Add an employer and update the global list
  addEmployer: (newEmp) => set((state) => ({
    employers: [newEmp, ...state.employers],
  })),
  
  // 3. Update an employer in the global list
  updateEmployer: (updatedEmp) => set((state) => ({
    employers: state.employers.map(emp => 
      emp.id === updatedEmp.id ? updatedEmp : emp
    ),
  })),

  // 4. Delete an employer (remove from list)
  deleteEmployer: (id) => set((state) => ({
    employers: state.employers.filter(emp => emp.id !== id),
    // Also filter out jobs associated with this employer ID
    jobs: state.jobs.filter(job => job.employer_id !== id),
  })),

  // 5. Add a new job
  addJob: (newJob) => set((state) => ({
    jobs: [newJob, ...state.jobs],
  })),
  
  // 6. Update a job
  updateJob: (updatedJob) => set((state) => {
  if (!updatedJob || !updatedJob.id) {
    console.error("updateJob failed: updatedJob is invalid", updatedJob);
    return state;
  }

  return {
    jobs: state.jobs
      .filter(job => job && job.id !== undefined) // remove undefined items
      .map(job =>
        job.id === updatedJob.id ? updatedJob : job
      ),
  };
}),


  // 7. Delete a job (remove from list)
  deleteJob: (id) => set((state) => ({
    jobs: state.jobs.filter(job => job.id !== id),
  })),

  // --- Candidates cache helpers ---
  getCandidatesPage: (page) => {
    const state = get();
    return state.candidatesPages[page] || null;
  },

  // Fetch a page; if filters are provided, always call IPC; otherwise try cache first
  fetchCandidatesPage: async ({ page = 1, searchTerm = '', status = '', position = '', pageSize = 20, forceRefresh = false }) => {
    const state = get();
    // If any filter present, don't use cache (unless forceRefresh requested)
    const isFiltered = !!(searchTerm || status || position);
    if (!isFiltered && !forceRefresh) {
      const cached = state.candidatesPages[page];
      if (cached) {
        return { success: true, data: cached, totalCount: state.candidatesTotal };
      }
    }

    // Fallback to IPC call
    try {
      const limit = pageSize;
      const offset = (page - 1) * pageSize;
      const res = await window.electronAPI.searchCandidates({ searchTerm, status, position, limit, offset });
      if (res && res.success) {
        // Cache unfiltered pages or when forceRefresh asked
        if (!isFiltered || forceRefresh) {
          set(state => ({ candidatesPages: { ...state.candidatesPages, [page]: res.data }, candidatesTotal: res.totalCount }));
        }
        return { success: true, data: res.data, totalCount: res.totalCount };
      }
      return { success: false, error: res && res.error ? res.error : 'Unknown error' };
    } catch (err) {
      console.error('fetchCandidatesPage error', err);
      return { success: false, error: err.message };
    }
  },

  // Clear candidates cache fully
  clearCandidatesCache: () => set({ candidatesPages: {}, candidatesSummary: [], candidatesTotal: 0 }),

  // Add a newly created candidate to the cached pages (prefers page 1)
  addCandidate: (newCandidate) => set((state) => {
    try {
      const pageSize = state.candidatesPageSize || 20;
      const pages = { ...state.candidatesPages };

      // Prepend to page 1
      const page1 = pages[1] ? [newCandidate, ...pages[1]] : [newCandidate];
      pages[1] = page1.slice(0, pageSize);

      // Also update candidatesSummary if present
      const summary = state.candidatesSummary ? [newCandidate, ...state.candidatesSummary] : [newCandidate];

      return {
        candidatesPages: pages,
        candidatesSummary: summary,
        candidatesTotal: (state.candidatesTotal || 0) + 1,
      };
    } catch (e) {
      console.error('addCandidate failed', e);
      return state;
    }
  }),

}));

export default useDataStore;