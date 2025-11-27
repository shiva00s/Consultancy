import React, { useState, useEffect, useCallback } from 'react';
import { FiSave, FiLock, FiDollarSign, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const DURATION_OPTIONS = ['1 Year', '2 Years', 'Lifetime'];
const AMC_OPTIONS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annually'];

// Default structure for pricing (all zeros)
const INITIAL_PRICING = DURATION_OPTIONS.reduce((acc, duration) => {
    acc[duration] = AMC_OPTIONS.reduce((innerAcc, amc) => {
        innerAcc[amc] = '0.00';
        return innerAcc;
    }, {});
    return acc;
}, {});

function LicensePricingManager({ user }) {
    const [pricing, setPricing] = useState(INITIAL_PRICING);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 1. Fetch saved pricing on mount
    const fetchPricing = useCallback(async () => {
        if (user.role !== 'super_admin') {
            setLoading(false);
            return;
        }
        
        const res = await window.electronAPI.getLicensePricing();
        if (res.success && res.pricing) {
            setPricing({ ...INITIAL_PRICING, ...res.pricing }); // Merge to ensure all keys exist
        } else if (res.error) {
            toast.error(res.error);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchPricing();
    }, [fetchPricing]);

    // 2. Handle price change in matrix
    const handlePriceChange = (duration, amc, value) => {
        // Simple input validation to restrict to numbers/decimals
        if (!/^\d*\.?\d*$/.test(value)) return;

        setPricing(prev => ({
            ...prev,
            [duration]: {
                ...prev[duration],
                [amc]: value
            }
        }));
    };

    // 3. Save Pricing Matrix
    const handleSave = async () => {
        if (user.role !== 'super_admin') {
            toast.error("Access Denied.");
            return;
        }
        setSaving(true);
        
        // Clean and save the object
        const pricingData = JSON.stringify(pricing);
        
        const res = await window.electronAPI.saveLicensePricing({ user, pricing: pricingData });
        
        if (res.success) {
            toast.success('License Pricing updated successfully!');
        } else {
            toast.error(res.error || 'Failed to save pricing.');
        }
        setSaving(false);
    };

    if (loading) return <p>Loading pricing matrix...</p>;
    if (user.role !== 'super_admin') return <p className="form-message error"><FiAlertTriangle /> Access Denied: Only Super Admin can manage licensing.</p>;

    return (
        <div className="settings-section-card" style={{gridColumn: '1 / -1'}}>
            <h2><FiLock /> License & AMC Pricing Management</h2>
            <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>
                <FiDollarSign /> Define the base price (excluding taxes/discounts) for each License Duration and Annual Maintenance Contract (AMC) schedule.
            </p>

            <div style={{overflowX: 'auto'}}>
                <table className="report-table">
                    <thead>
                        <tr>
                            <th>Duration</th>
                            {AMC_OPTIONS.map(amc => (
                                <th key={amc}>{amc} AMC Price</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {DURATION_OPTIONS.map(duration => (
                            <tr key={duration}>
                                <td><strong>{duration}</strong></td>
                                {AMC_OPTIONS.map(amc => (
                                    <td key={`${duration}-${amc}`}>
                                        <div className="form-group" style={{margin: 0, minWidth: '120px'}}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="Rs. 0.00"
                                                value={pricing[duration][amc]}
                                                onChange={(e) => handlePriceChange(duration, amc, e.target.value)}
                                            />
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{marginTop: '2rem', display: 'flex', justifyContent: 'flex-end'}}>
                <button className="btn" onClick={handleSave} disabled={saving}>
                    <FiSave /> {saving ? 'Saving...' : 'Save Pricing Matrix'}
                </button>
            </div>
        </div>
    );
}

export default LicensePricingManager;