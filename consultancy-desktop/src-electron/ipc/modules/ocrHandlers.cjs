// src-electron/ipc/modules/ocrHandlers.cjs
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');
const { spawn } = require('child_process');
const { logAction } = require('../utils/logAction.cjs');

const tempDir = path.join(os.tmpdir(), 'paddle_ocr_temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const extractResumeDetails = (text) => {
    const details = {};
    
    // Email Regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = text.match(emailRegex);
    if (emailMatch) details.email = emailMatch[0];
    
    // Phone Regex (Generic 10-12 digit)
    const phoneRegex = /\b\d{10,12}\b/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) details.contact = phoneMatch[0];

    // Name Heuristic
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 0) details.name = lines[0].substring(0, 50);

    return details;
};

function registerOCRHandlers(app) {
    console.log('🔍 Registering OCR Handlers...');

    ipcMain.handle('extract-resume-text', async (event, { user, filePath }) => {
        const ext = path.extname(filePath).toLowerCase();

        try {
            let extractedText = '';

            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdf(dataBuffer);
                extractedText = pdfData.text;
            } else if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff'].includes(ext)) {
                const result = await Tesseract.recognize(filePath, 'eng', {
                    logger: (m) => console.log(m)
                });
                extractedText = result.data.text;
            } else {
                return { success: false, error: 'Unsupported file format for text extraction.' };
            }

            const details = extractResumeDetails(extractedText);
            
            if (user) {
                logAction(user, 'extract_resume_text', 'system', 1, `File: ${path.basename(filePath)}`);
            }

            return { success: true, text: extractedText, details };
        } catch (error) {
            console.error('Resume extraction failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('extract-text-paddleocr', async (event, { user, imagePath }) => {
        return new Promise((resolve) => {
            if (!fs.existsSync(imagePath)) {
                return resolve({ success: false, error: 'Image file not found.' });
            }

            const pythonScript = path.join(__dirname, '../../python/paddle_ocr.py');
            const pythonProcess = spawn('python', [pythonScript, imagePath]);

            let stdoutData = '';
            let stderrData = '';

            pythonProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('PaddleOCR Python Error:', stderrData);
                    return resolve({ success: false, error: stderrData || 'OCR process failed.' });
                }

                try {
                    const result = JSON.parse(stdoutData);
                    
                    if (user) {
                        logAction(user, 'paddleocr_extract', 'system', 1, `Image: ${path.basename(imagePath)}`);
                    }

                    resolve({ success: true, data: result });
                } catch (err) {
                    console.error('Failed to parse PaddleOCR output:', err);
                    resolve({ success: false, error: 'Failed to parse OCR output.' });
                }
            });
        });
    });

    console.log('✅ OCR Handlers Registered');
}

module.exports = { registerOCRHandlers };
