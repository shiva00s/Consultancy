// src-electron/server/api.cjs

const express = require('express');
const cors = require('cors');
const ip = require('ip');
const jwt = require('jsonwebtoken');
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
    getJwtSecret
} = require('../db/queries.cjs');

const app = express();
const PORT = 3000;
let JWT_SECRET = "initial_secret_loading";

// Load JWT secret
async function loadSecret() {
    try {
        JWT_SECRET = await getJwtSecret();
        console.log("🔑 JWT Secret loaded/generated securely.");
    } catch (e) {
        console.error("CRITICAL: Failed to load JWT Secret, using fallback.", e);
    }
}
loadSecret();

// Middleware
app.use(cors()); 
app.use(express.json({ limit: '50mb' }));

// --- SECURITY MIDDLEWARE ---
const authMiddleware = async (req, res, next) => {
    // ✅ UPDATED: Skip auth for WhatsApp webhook endpoints
    const publicPaths = [
        '/', 
        '/api/login',
        '/webhook/whatsapp', // WhatsApp webhook verification
    ];
    
    if (publicPaths.includes(req.path)) return next();

    // Check Feature Flag
    const flagsRes = await getSuperAdminFeatureFlags();
    if (!flagsRes.success || !flagsRes.data || !flagsRes.data.isMobileAccessEnabled) {
        return res.status(403).json({ 
            success: false, 
            error: "Mobile Access is currently disabled by the System Administrator." 
        });
    }

    // Verify JWT Token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: "Access Denied: No Token Provided." });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: "Access Denied: Invalid or Expired Token." });
        }
        req.user = user;
        next();
    });
};

// Apply Middleware Globally
app.use(authMiddleware);

// --- WHATSAPP WEBHOOK ROUTES (BEFORE AUTH) ---
// These must be defined BEFORE authMiddleware or added to publicPaths

// ✅ WhatsApp Webhook Verification (GET)
app.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // Set your webhook verify token in environment or config
    const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token_here';
    
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ WhatsApp webhook verified');
        res.status(200).send(challenge);
    } else {
        console.warn('⚠️ WhatsApp webhook verification failed');
        res.sendStatus(403);
    }
});

// ✅ WhatsApp Webhook Receiver (POST)
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const data = req.body;
        
        if (data.object === 'whatsapp_business_account') {
            // Import webhook handler
            const { handleIncomingMessage, handleStatusUpdate } = require('./whatsapp-webhook.cjs');
            
            for (const entry of data.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'messages') {
                        const value = change.value;
                        
                        // Handle incoming messages
                        if (value.messages) {
                            await handleIncomingMessage(value);
                        }
                        
                        // Handle status updates (sent, delivered, read)
                        if (value.statuses) {
                            await handleStatusUpdate(value);
                        }
                    }
                }
            }
            
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        res.sendStatus(500);
    }
});

// --- EXISTING ROUTES ---

// 1. Health Check
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        app: 'Consultancy Server', 
        ip: ip.address(),
        auth_required: true
    });
});

// 2. Authentication
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const result = await login(username, password);
    
    if (result.success) {
        const token = jwt.sign(
            { id: result.id, username: result.username, role: result.role }, 
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
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
        
        if (!textData.name || !textData.passportNo) {
            return res.status(400).json({ success: false, error: "Name and Passport are required." });
        }
        
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

// 7. Delete Candidate
app.delete('/api/candidates/:id', async (req, res) => {
    try {
        const candidateId = req.params.id;
        if (!candidateId) {
            return res.status(400).json({ success: false, error: "Candidate ID is required for deletion." });
        }
        
        const result = await deleteCandidate(candidateId); 

        if (result.success) {
            res.json({ success: true, message: `Candidate ${candidateId} soft-deleted.` });
        } else {
            res.status(500).json(result);
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. Document Upload
app.post('/api/documents/:candidateId', upload.single('document'), async (req, res) => {
    try {
        const candidateId = req.params.candidateId;
        const file = req.file;

        if (!candidateId || !file) {
            return res.status(400).json({ success: false, error: "Candidate ID and document file are required." });
        }
        
        const fileData = {
            buffer: file.buffer,
            fileName: file.originalname,
            fileType: file.mimetype,
            category: req.body.category || 'Uncategorized',
        };

        const result = await saveDocumentFromApi({ 
            candidateId, 
            user: req.user,
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

// ✅ NEW: WhatsApp Send Message API
app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { to, message, type = 'text', conversationId } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ success: false, error: "Phone number and message are required." });
        }

        // Import WhatsApp service
        const { sendWhatsAppMessage } = require('./whatsapp-service.cjs');
        
        const result = await sendWhatsAppMessage({
            to,
            message,
            type,
            conversationId,
            userId: req.user.id
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('WhatsApp send error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ NEW: WhatsApp Upload Media
app.post('/api/whatsapp/upload-media', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ success: false, error: "File is required." });
        }

        const { uploadWhatsAppMedia } = require('./whatsapp-service.cjs');
        
        const result = await uploadWhatsAppMedia(file);

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('WhatsApp media upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- START SERVER ---
function startServer() {
    // ✅ FIXED: Return server instance
    const server = app.listen(PORT, '0.0.0.0', () => {
        const localIP = ip.address();
        console.log(`============================================`);
        console.log(`📱 MOBILE API SERVER RUNNING (SECURE)`);
        console.log(`🔗 Connect: http://${localIP}:${PORT}`);
        console.log(`🔑 JWT Authentication Enabled`);
        console.log(`📲 WhatsApp Webhooks Ready`);
        console.log(`============================================`);
    });

    return server; // ✅ Return server instance for Socket.io
}

// Public file access route (signed temporary URLs)
app.get('/public/files/:token/:filename', async (req, res) => {
    try {
        const token = req.params.token;
        const jwt = require('jsonwebtoken');
        const { getJwtSecret } = require('../db/queries.cjs');
        const secret = await getJwtSecret();

        // Verify token
        let payload;
        try {
            payload = jwt.verify(token, secret);
        } catch (err) {
            return res.status(403).send('Invalid or expired token');
        }

        const filePath = payload && payload.path;
        if (!filePath) return res.status(400).send('Invalid token payload');

        // Security: ensure the file is inside app userData documents folder
        const userData = require('electron').app ? require('electron').app.getPath('userData') : null;
        const path = require('path');
        const fs = require('fs');
        const mime = require('mime');

        // Allow serving files from `documents` or `candidate_files` under userData
        if (userData) {
            const documentsDir = path.join(userData, 'documents');
            const candidateFilesDir = path.join(userData, 'candidate_files');
            const allowed = [documentsDir, candidateFilesDir];

            const normalized = path.resolve(filePath);
            const isAllowed = allowed.some((d) => normalized.startsWith(path.resolve(d) + path.sep) || normalized === path.resolve(d));
            if (!isAllowed) {
                return res.status(403).send('Access denied');
            }
        }

        if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

        // Set explicit content-type for reliability
        try {
            const contentType = (mime && typeof mime.getType === 'function') ? mime.getType(filePath) : null;
            if (contentType) res.setHeader('Content-Type', contentType);
        } catch (e) {}

        return res.sendFile(path.resolve(filePath));
    } catch (err) {
        console.error('Public file route error:', err);
        return res.status(500).send('Server error');
    }
});

// ✅ Export both server function and app instance
module.exports = { startServer, app };
