import { useState, useEffect, useCallback } from 'react';

export function useAutoFillCandidateData(candidateId) {
  const [autoFillData, setAutoFillData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAutoFillData = useCallback(async () => {
    if (!candidateId) {
      setAutoFillData({
        name: 'N/A',
        position: 'N/A',
        passport: 'N/A',
        phone: 'N/A',
        country: 'N/A',
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Get candidate profile data
      const candidateRes = await window.electronAPI.getCandidateById({ 
        candidateId 
      });

      if (!candidateRes.success || !candidateRes.data || Object.keys(candidateRes.data).length === 0) {
        throw new Error('No candidate data found');
      }

      const candidateData = candidateRes.data;

      // 2. Get job placements
      const jobPlacementsRes = await window.electronAPI.getCandidateJobPlacements({ 
        candidateId 
      });

      let jobData = null;
      let positionFromJob = null;

      if (jobPlacementsRes.success && jobPlacementsRes.data?.length > 0) {
        const activeJob = jobPlacementsRes.data.find(j => j.placementStatus === 'Assigned') || 
                          jobPlacementsRes.data[0];

        if (activeJob && activeJob.jobId) {
          const jobOrderRes = await window.electronAPI.getJobOrderById({ 
            jobId: activeJob.jobId 
          });
          
          if (jobOrderRes.success && jobOrderRes.data) {
            jobData = jobOrderRes.data;
            positionFromJob = jobData.positionTitle || jobData.position;
          }
        }
      }

      // 3. Build auto-fill data with comprehensive fallbacks
      setAutoFillData({
        // Name fallbacks
        name: candidateData.name || 
              candidateData.fullName || 
              candidateData.full_name || 
              candidateData.candidateName ||
              candidateData.candidate_name ||
              'N/A',
        
        // Phone fallbacks
        phone: candidateData.contact ||
               candidateData.mobile || 
               candidateData.mobile_number || 
               candidateData.mobileNumber ||
               candidateData.phone || 
               candidateData.phone_number || 
               candidateData.phoneNumber ||
               candidateData.contact_number ||
               candidateData.contactNumber ||
               candidateData.whatsapp ||
               candidateData.whatsapp_number ||
               'N/A',
        
        // Passport fallbacks
        passport: candidateData.passportNo ||  // <-- This is your DB column
                  candidateData.passport_number || 
                  candidateData.passportNumber || 
                  candidateData.passport_no ||
                  candidateData.passport || 
                  'N/A',
        
        // ✅ FIX: Position fallbacks - Capital 'Position' FIRST!
        position: candidateData.Position ||  // <-- THIS IS YOUR DB COLUMN!
                  positionFromJob || 
                  candidateData.position_applying_for || 
                  candidateData.positionApplyingFor ||
                  candidateData.position || 
                  candidateData.designation ||
                  'N/A',
        
        // Country from job
        country: jobData?.country || 'N/A',
        
        // Employer info
        employer: jobData?.employerName || jobData?.companyName || null,
        candidateId: candidateId,
      });

    } catch (error) {
      console.error('❌ Auto-fill data fetch error:', error);
      setError(error.message);
      
      setAutoFillData({
        name: 'N/A',
        position: 'N/A',
        passport: 'N/A',
        phone: 'N/A',
        country: 'N/A',
      });
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchAutoFillData();
  }, [fetchAutoFillData]);

  return { 
    autoFillData, 
    loading, 
    error,
    refetch: fetchAutoFillData 
  };
}
