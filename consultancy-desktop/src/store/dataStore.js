import { create } from 'zustand';
import toast from 'react-hot-toast';

const useDataStore = create((set, get) => ({
  employers: [],
  jobs: [],
  isLoaded: false,
  isLoading: false,
  error: null,

  fetchInitialData: async () => {
    const state = get();
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
        set({
          employers: empRes.data,
          jobs: jobRes.data,
          isLoaded: true,
          isLoading: false,
        });
        console.log('Zustand Store: Initial data loaded successfully.');
      } else {
        const errorMsg = empRes.error || jobRes.error || 'Failed to load initial data.';
        set({ error: errorMsg, isLoaded: true, isLoading: false });
        toast.error(`Store Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
      set({ error: err.message, isLoaded: false, isLoading: false });
      toast.error('Failed to load data.');
    }
  },

  reset: () =>
    set({
      employers: [],
      jobs: [],
      isLoaded: false,
      isLoading: false,
      error: null,
    }),

  addEmployer: (newEmp) =>
    set((state) => ({
      employers: [newEmp, ...state.employers],
    })),

  // ✅ FIXED: Force complete array recreation
  updateEmployer: (updatedEmp) =>
    set((state) => ({
      employers: state.employers.map((emp) =>
        emp.id === updatedEmp.id ? { ...emp, ...updatedEmp } : emp
      ),
    })),

  deleteEmployer: (id) =>
    set((state) => ({
      employers: state.employers.filter((emp) => emp.id !== id),
      jobs: state.jobs.filter((job) => job.employerid !== id),
    })),

  addJob: (newJob) =>
    set((state) => ({
      jobs: [newJob, ...state.jobs],
    })),

  updateJob: (updatedJob) =>
    set((state) => {
      if (!updatedJob || !updatedJob.id) {
        console.error('updateJob failed: updatedJob is invalid', updatedJob);
        return state;
      }
      return {
        jobs: state.jobs
          .filter((job) => job && job.id !== undefined)
          .map((job) => (job.id === updatedJob.id ? { ...updatedJob } : job)),
      };
    }),

  deleteJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== id),
    })),
}));

export default useDataStore;
