const express = require('express');
const cors = require('cors');
const ip = require('ip');
const jwt = require('jsonwebtoken');
// <--- NEW IMPORT
const multer = require('multer');
const { saveDocumentFromApi } = require('../ipc/handlers.cjs');
const upload = multer({ storage: multer.memoryStorage() });
const { 
    login, 
    searchCandidates, 
    getCandidateDetails, 
    createCandidate, 
    deleteCandidate,
    addPassportEntry, 
    getPassportTracking,
    getSuperAdminFeatureFlags,
    getJwtSecret // 🐞 FIX: Import getJwtSecret
} = require('../db/queries.cjs');
const app = express();
const PORT = 3000;
let JWT_SECRET = "initial_secret_loading"; // Placeholder until loaded

// 🐞 FIX: Function to load the secret securely
async function loadSecret() {
    try {
        JWT_SECRET = await getJwtSecret();
        console.log("🔑 JWT Secret loaded/generated securely.");
    } catch (e) {
        console.error("CRITICAL: Failed to load JWT Secret, using fallback.", e);
    }
}
loadSecret(); // Load the secret when the module starts

// Middleware
app.use(cors()); 
app.use(express.json({ limit: '50mb' }));
// --- SECURITY MIDDLEWARE ---
const authMiddleware = async (req, res, next) => {
    // 1. Skip check for Public Routes (Health check & Login)
    if (req.path === '/' || req.path === '/api/login') return next();

    // 2. Check Feature Flag (Global Kill Switch)
    const flagsRes = await getSuperAdminFeatureFlags();
    if (!flagsRes.success || !flagsRes.data || !flagsRes.data.isMobileAccessEnabled) {
        return res.status(403).json({ 
            success: false, 
            error: "Mobile Access is currently disabled by the System Administrator." 
        });
    }

    // 3. Verify JWT Token (Authentication)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ success: false, error: "Access Denied: No Token Provided." });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: "Access Denied: Invalid or Expired Token." });
        }
        // Attach user info to request for use in routes
        req.user = user;
        next();
    });
};

// Apply Middleware Globally
app.use(authMiddleware);
// ---------------------------

// --- ROUTES ---

// 1. Health Check
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        app: 'Consultancy Server', 
        ip: ip.address(),
        auth_required: true
    });
});
// 2. Authentication (Issues Token)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const result = await login(username, password);
    
    if (result.success) {
        // Generate Token valid for 24 hours
        const token = jwt.sign(
            { id: result.id, username: result.username, role: result.role }, 
            JWT_SECRET, // 🐞 FIX: Use the securely loaded secret
            { expiresIn: '24h' }
        );
        
        // Return user info + Token
        res.json({ ...result, token });
    } else {
        res.status(401).json(result);
    }
});
// 3. Candidate List / Search
app.get('/api/candidates', async (req, res) => {
    const { q, status, position, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const result = await searchCandidates(q, status, position, limit, offset);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json(result);
    }
});
// 4. Add New Candidate
app.post('/api/candidates', async (req, res) => {
    try {
        const textData = req.body;
        
        // Validation
        if (!textData.name || !textData.passportNo) {
            return res.status(400).json({ success: false, error: "Name and Passport are required." });
        }
        
        
// Use the Authenticated User from the Token
        // Note: We pass textData to createCandidate. If you want to log WHO created it, 
        // you'd need to update createCandidate to accept a user ID, but for now we just secure the endpoint.
        const result = await createCandidate(textData);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// 5. Candidate Details
app.get('/api/candidates/:id', async (req, res) => {
    const result = await getCandidateDetails(req.params.id);
    if (result.success) {
        res.json(result);
    } else {
        res.status(404).json(result);
    }
});
// 6. Passport Tracking
app.get('/api/passport/:candidateId', async (req, res) => {
    const result = await getPassportTracking(req.params.candidateId);
    res.json(result);
});
app.post('/api/passport', async (req, res) => {
    const result = await addPassportEntry(req.body);
    res.json(result);
});
// 6. Delete Candidate (Used by Mobile)
app.delete('/api/candidates/:id', async (req, res) => {
    try {
        const candidateId = req.params.id;
        if (!candidateId) {
            return res.status(400).json({ success: false, error: "Candidate ID is required for deletion." });
        }
        
        // Use the existing soft delete function from the main Electron handlers
        const result = await deleteCandidate(candidateId); 

        if (result.success) {
            // Note: Audit logging would happen in the deleteCandidate handler in the main IPC flow.
            res.json({ success: true, message: `Candidate ${candidateId} soft-deleted.` });
        } else {
            res.status(500).json(result);
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// 7. Document Upload Endpoint (Phase 4.2)
// Uses multer middleware to handle file data
app.post('/api/documents/:candidateId', upload.single('document'), async (req, res) => {
    try {
        const candidateId = req.params.candidateId;
        const file = req.file; // File data handled by multer

        if (!candidateId || !file) {
            return res.status(400).json({ success: false, error: "Candidate ID and document file are required." });
        }
    
        
        // --- PROCESS THE FILE ---
        // Since we are in the Express thread, we can't directly use the existing IPC handler (addDocuments).
        // We need a dedicated query function to save the file and link it to the DB.
        
        const fileData = {
            buffer: file.buffer,
            fileName: file.originalname,
            fileType: file.mimetype,
            category: req.body.category || 'Uncategorized', // Expect category in body
        };

        const result = await saveDocumentFromApi({ 
            candidateId, 
            user: req.user, // User attached by JWT middleware
            fileData 
        });
        if (result.success) {
            res.json({ success: true, message: "Document uploaded and saved.", documentId: result.documentId });
        } else {
            res.status(500).json(result);
        }

    } catch (err) {
        console.error('API Document Upload Error:', err);
        res.status(500).json({ success: false, error: `Upload failed: ${err.message}` });
    }
});

const handleDelete = async () => {
    Alert.alert(
        "Confirm Deletion",
        "Are you sure you want to delete this candidate? This action is queued for soft-deletion.",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                    setLoading(true);
                    try {
                        if (networkStatus === 'online') {
                            // --- A. ONLINE MODE: Attempt immediate sync (DELETE) ---
                            const res = await api.delete(`/candidates/${id}`);
                            if (res.data.success) {
                                Alert.alert("Deleted", "Candidate deleted and synced.");
                                router.replace('/(tabs)'); // Redirect to list
                            } else {
                                throw new Error(res.data.error || "Server failed to delete.");
                            }
                        } else {
                            // --- B. OFFLINE MODE: Queue for later sync (DELETE) ---
                            const localId = `delete-${id}`;
                            addToQueue({
                                localId: localId,
                                payload: { candidate_id: id },
                                endpoint: `/candidates/${id}`,
                                method: 'DELETE',
                            });
                            Alert.alert("Queued", "Deletion queued and will sync when online.");
                            router.replace('/(tabs)');
                        }
                    } catch (error) { // Removed : any
                        Alert.alert("Error", error.message || "Failed to process deletion.");
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]
    );
};

// --- START SERVER ---
function startServer() {
    app.listen(PORT, '0.0.0.0', () => {
        const localIP = ip.address();
        console.log(`============================================`);
        console.log(`📱 MOBILE API SERVER RUNNING (SECURE)`);
        console.log(`🔗 Connect: http://${localIP}:${PORT}`);
        console.log(`🔑 JWT Authentication Enabled`);
        console.log(`============================================`);
    });
}

module.exports = { startServer };