// src/hooks/useAutoFillCandidateData.js

import { useState, useEffect } from 'react';

export const useAutoFillCandidateData = (candidateId) => {
  const [autoFillData, setAutoFillData] = useState({
    // Profile data
    name: '',
    passport_no: '',
    passport_expiry: '',
    position_applying_for: '',
    dob: '',
    education: '',
    experience_years: '',
    contact_number: '',
    aadhar_number: '',
    
    // Job placement data (if assigned)
    job_position: '',
    job_country: '',
    employer_name: '',
    employer_country: '',
    salary: '',
    
    // Combined/Computed fields
    position_combined: '', // Profile + Job position
    country: '', // From job placement
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!candidateId) return;

    const fetchAutoFillData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get candidate profile data
        const candidateData = await window.electronAPI.getCandidateById({ 
          candidateId 
        });

        // Get active job placements for this candidate
        const jobPlacements = await window.electronAPI.getCandidateJobPlacements({ 
          candidateId 
        });

        // Get the most recent/active job placement
        const activeJob = jobPlacements?.find(j => j.status === 'ASSIGNED') || 
                          jobPlacements?.[0];

        let jobData = null;
        if (activeJob) {
          // Get detailed job order information
          jobData = await window.electronAPI.getJobOrderById({ 
            jobId: activeJob.employer_job_id 
          });
        }

        // Prepare combined position field
        const profilePosition = candidateData.position_applying_for || '';
        const jobPosition = jobData?.position_title || '';
        
        let positionCombined = '';
        if (profilePosition && jobPosition) {
          // Both exist - combine with comma
          positionCombined = `${profilePosition}, ${jobPosition}`;
        } else {
          // Use whichever exists (priority to profile)
          positionCombined = profilePosition || jobPosition || '';
        }

        setAutoFillData({
          // Profile data
          name: candidateData.name || '',
          passport_no: candidateData.passport_no || '',
          passport_expiry: candidateData.passport_expiry || '',
          position_applying_for: candidateData.position_applying_for || '',
          dob: candidateData.dob || '',
          education: candidateData.education || '',
          experience_years: candidateData.experience_years || '',
          contact_number: candidateData.contact_number || '',
          aadhar_number: candidateData.aadhar_number || '',
          
          // Job placement data
          job_position: jobPosition,
          job_country: jobData?.country || '',
          employer_name: jobData?.employer_name || '',
          employer_country: jobData?.employer_country || '',
          salary: jobData?.salary || '',
          
          // Combined fields
          position_combined: positionCombined,
          country: jobData?.country || '', // Always from job order
        });

      } catch (err) {
        console.error('Error fetching auto-fill data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAutoFillData();
  }, [candidateId]);

  return { autoFillData, loading, error };
};
