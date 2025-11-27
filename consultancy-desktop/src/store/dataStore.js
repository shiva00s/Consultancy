import { create } from 'zustand';
import toast from 'react-hot-toast';

// Define the store structure
const useDataStore = create((set, get) => ({
  employers: [],
  jobs: [],
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
          isLoaded: true,
          isLoading: false,
        }));
        console.log("Zustand Store: Initial data loaded successfully.");
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
  updateJob: (updatedJob) => set((state) => ({
    jobs: state.jobs.map(job => 
      job.id === updatedJob.id ? updatedJob : job
    ),
  })),

  // 7. Delete a job (remove from list)
  deleteJob: (id) => set((state) => ({
    jobs: state.jobs.filter(job => job.id !== id),
  })),

}));

export default useDataStore;