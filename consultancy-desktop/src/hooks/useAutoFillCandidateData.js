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
            positionFromJob = jobData.position;
          }
        }
      }

      // 3. Build auto-fill data with comprehensive fallbacks
      setAutoFillData({
        name: candidateData.fullName || 
              candidateData.full_name || 
              candidateData.name || 
              candidateData.candidateName ||
              candidateData.candidate_name ||
              'N/A',
        
        phone: candidateData.mobile || 
               candidateData.mobile_number || 
               candidateData.mobileNumber ||
               candidateData.phone || 
               candidateData.phone_number || 
               candidateData.phoneNumber ||
               candidateData.contact ||
               candidateData.contact_number ||
               candidateData.contactNumber ||
               candidateData.whatsapp ||
               candidateData.whatsapp_number ||
               'N/A',
        
        passport: candidateData.passport_number || 
                  candidateData.passportNumber || 
                  candidateData.passport || 
                  'N/A',
        
        position: candidateData.position_applying_for || 
                  candidateData.positionApplyingFor ||
                  positionFromJob || 
                  candidateData.position || 
                  candidateData.designation ||
                  'N/A',
        
        country: jobData?.country || 'N/A',
        
        employer: jobData?.employerName || null,
        candidateId: candidateId,
      });

    } catch (error) {
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
