const path = require('path');
const fs = require('fs');
const os = require('os');
const Tesseract = require('tesseract.js');

const tempDir = path.join(os.tmpdir(), "paddle_ocr_temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const convertMRZDate = (yyMMdd) => {
    const clean = yyMMdd.replace(/O/g, '0');
    
    if (!/^\d{6}$/.test(clean)) return null;
    
    const year = parseInt(clean.substring(0, 2), 10);
    const month = clean.substring(2, 4);
    const day = clean.substring(4, 6);

    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    
    return `${fullYear}-${month}-${day}`;
};

const parsePassportDataRobust = (rawText) => {
    if (!rawText) return null;

    const cleanText = rawText.toUpperCase().replace(/[^A-Z0-9<]/g, '');

    const pattern = /([A-Z0-9<]{9})[\dO][A-Z<]{3}([\dO]{6})[\dO][FM<]([\dO]{6})[\dO]/;
    
    const match = cleanText.match(pattern);

    if (match) {
        const rawPassport = match[1].replace(/</g, '');
        const rawDob = match[2];
        const rawExpiry = match[3];

        return {
            documentType: 'PASSPORT',
            passportNo: rawPassport,
            dob: convertMRZDate(rawDob),
            expiry: convertMRZDate(rawExpiry),
        };
    }
    
    return null;
};

const registerOcrHandlers = (ipcMain) => {
    ipcMain.handle('ocr-scan-passport', async (event, { fileBuffer }) => { 
        if (!fileBuffer) { 
            return { success: false, error: 'No file buffer provided for OCR.' };
        }
        
        const buffer = Buffer.from(fileBuffer); 
        let worker;
        
        try {
            const repoTessPath = path.join(__dirname, '..', '..', '..'); // Adjust path to find eng.traineddata
            const localEng = path.join(repoTessPath, 'eng.traineddata');
            const workerOptions = {};

            if (fs.existsSync(localEng)) {
                workerOptions.langPath = repoTessPath;
            }

            worker = await Tesseract.createWorker('eng', undefined, workerOptions);
            
            const { data: { text } } = await worker.recognize(buffer);
            
            const passportData = parsePassportDataRobust(text);

            if (passportData) {
                return { success: true, data: { passport: passportData, rawText: text } };
            }

            return {
                success: true,
                data: { passport: null, rawText: text }, 
                error: 'Could not detect valid Passport Pattern (MRZ) in image.',
            };

        } catch (err) {
            console.error("OCR FAILED - Exception:", err);
            return { success: false, error: `OCR Engine Error: ${err.message}` };
        } finally {
            if (worker) await worker.terminate(); 
        }
    });
};

module.exports = { registerOcrHandlers };
