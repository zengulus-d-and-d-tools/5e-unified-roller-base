
// Importer for D&D 5e Character Sheets from PDF
// Depends on pdf.min.js being loaded before this script

const Importer = {
    PDFJS_WORKER_CDN: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    LOCAL_WORKER_CANDIDATES: ['js/pdf.worker.min.js'],
    DEBUG: false,

    debug: function (...args) {
        if (!this.DEBUG) return;
        console.log(...args);
    },

    // Entry point
    init: function () {
        this.debug("Importer initialized");
        if (typeof pdfjsLib !== 'undefined') {
            // Prefer a local worker when present; if unavailable, runtime falls back below.
            if (this.LOCAL_WORKER_CANDIDATES.length) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = this.LOCAL_WORKER_CANDIDATES[0];
            }
        } else {
            console.error("pdfjsLib not found! Ensure pdf.min.js is loaded.");
        }
    },

    getWorkerCandidates: function () {
        const candidates = [...this.LOCAL_WORKER_CANDIDATES];
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
            candidates.push(this.PDFJS_WORKER_CDN);
        }
        return candidates;
    },

    loadPdfDocument: async function (arrayBuffer) {
        let lastError = null;
        const candidates = this.getWorkerCandidates();

        if (typeof pdfjsLib === 'undefined' || typeof pdfjsLib.getDocument !== 'function') {
            throw new Error('pdf.js runtime unavailable.');
        }

        for (const workerSrc of candidates) {
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                return await loadingTask.promise;
            } catch (error) {
                lastError = error;
                console.warn(`PDF worker attempt failed (${workerSrc})`, error);
            }
        }

        // Final fallback for builds that can run in "fake worker" mode.
        try {
            if (pdfjsLib.GlobalWorkerOptions) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            }
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true });
            return await loadingTask.promise;
        } catch (error) {
            lastError = error;
        }

        throw lastError || new Error("Unable to initialize PDF parser.");
    },

    // Trigger file selection
    triggerImport: function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = (e) => {
            const target = e && e.target ? e.target : null;
            const files = target && target.files ? target.files : null;
            if (files && files.length > 0) {
                this.processFile(files[0]);
            }
        };
        input.click();
    },

    // Process the selected file
    processFile: async function (file) {
        this.debug(`Processing file: ${file.name}`);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await this.loadPdfDocument(arrayBuffer);

            this.debug(`PDF loaded. Pages: ${pdf.numPages}`);

            let fullText = "";
            let parsedData = {};

            // Iterate over all pages
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                // Simple text extraction strategy: join all items with a space
                // This is the "literal text" approach requested
                const pageText = textContent.items.map(item => item.str).join(" ");
                fullText += pageText + "\n\n";

                // Extract Form Data (Annotations)
                const annotations = await page.getAnnotations();
                this.debug(`Page ${i} Annotations:`, annotations);

                if (annotations.length > 0) {
                    fullText += `--- Form Data Page ${i} ---\n`;
                    annotations.forEach(ann => {
                        if (ann.subtype === 'Widget') {
                            const fieldName = ann.fieldName || ann.id;
                            const fieldValue = ann.fieldValue || ann.buttonValue || "";
                            if (fieldValue) {
                                fullText += `${fieldName}: ${fieldValue}\n`;
                                // Accumulate data for mapping
                                parsedData[fieldName] = fieldValue;
                            }
                        }
                    });
                    fullText += "\n";
                }
            }

            this.debug("--- Extracted Text Start ---");
            this.debug(fullText);
            this.debug("--- Extracted Text End ---");

            // Smart Sort / Mapping
            this.applyToSheet(parsedData);

            alert("PDF Imported! Character sheet updated.");

        } catch (error) {
            console.error("Error processing PDF:", error);
            alert("Error processing PDF. See console for details.");
        }
    },

    // Map extracted PDF data to the application's data structure
    applyToSheet: function (pdfData) {
        if (typeof window.data === 'undefined' || typeof window.save !== 'function') {
            console.error("Application data not found. Cannot apply import.");
            return;
        }

        const d = window.data;
        this.debug("Applying data to sheet...", pdfData);

        // --- META ---
        if (pdfData["CharacterName"]) d.meta.name = pdfData["CharacterName"];
        if (pdfData["Speed"]) d.meta.speed = parseInt(pdfData["Speed"]) || d.meta.speed;
        if (pdfData["Init"]) d.meta.init = parseInt(pdfData["Init"]) || 0;

        // Level (Parse "Cleric 5")
        if (pdfData["CLASS  LEVEL"]) {
            const match = pdfData["CLASS  LEVEL"].match(/(\d+)/);
            if (match) d.meta.level = parseInt(match[1]);
        }

        // --- ATTRIBUTES ---
        const statMap = {
            "STR": "str", "DEX": "dex", "CON": "con",
            "INT": "int", "WIS": "wis", "CHA": "cha"
        };
        for (const [pdfKey, sheetKey] of Object.entries(statMap)) {
            if (pdfData[pdfKey]) {
                d.stats[sheetKey].val = parseInt(pdfData[pdfKey]);
            }
        }

        // --- SAVING THROWS (Proficiency) ---
        // 'WisProf': '•' or 'ST Wisdom' > mod
        const saveMap = {
            "StrProf": "str", "DexProf": "dex", "ConProf": "con",
            "IntProf": "int", "WisProf": "wis", "ChaProf": "cha"
        };
        for (const [pdfKey, sheetKey] of Object.entries(saveMap)) {
            if (pdfData[pdfKey] && (pdfData[pdfKey].includes("•") || pdfData[pdfKey] === "P")) {
                d.stats[sheetKey].save = true;
            }
        }

        // --- VITALS ---
        if (pdfData["MaxHP"]) {
            this.debug("Found MaxHP:", pdfData["MaxHP"]);
            d.vitals.max = parseInt(pdfData["MaxHP"]);
            d.vitals.curr = d.vitals.max; // Set current to max initially
        } else {
            console.warn("MaxHP not found in PDF data");
        }

        if (pdfData["AC"]) d.ac.base = parseInt(pdfData["AC"]);

        // --- SKILLS ---
        // Map PDF skill names to internal lowercase keys
        const skillKeys = {
            "Acrobatics": "acrobatics", "Animal": "animal handling", "Arcana": "arcana",
            "Athletics": "athletics", "Deception": "deception", "History": "history",
            "Insight": "insight", "Intimidation": "intimidation", "Investigation": "investigation",
            "Medicine": "medicine", "Nature": "nature", "Perception": "perception",
            "Performance": "performance", "Persuasion": "persuasion", "Religion": "religion",
            "SleightofHand": "sleight of hand", "Stealth": "stealth", "Survival": "survival"
        };

        for (const [pdfKey, sheetKey] of Object.entries(skillKeys)) {
            // Check proficiency marker (e.g. "AthleticsProf": "P")
            const profKey = pdfKey + "Prof";
            if (pdfData[profKey] === "P" || pdfData[profKey] === "•") {
                d.skills[sheetKey] = 1; // Proficient
            }
        }

        // --- FEATURES & TRAITS ---
        // Combine all FeaturesTraits fields
        let traitText = "";
        for (let i = 1; i <= 10; i++) { // Check up to 10 potential fields
            const key = i === 1 ? "FeaturesTraits" : `FeaturesTraits${i}`; // Handle "FeaturesTraits" vs "FeaturesTraits1" mismatch if any
            if (pdfData[key] || pdfData[`FeaturesTraits${i}`]) {
                traitText += (pdfData[key] || pdfData[`FeaturesTraits${i}`]) + "\n";
            }
        }

        if (traitText) {
            this.debug("Parsing Features...");
            d.features = []; // Clear existing features

            // Regex to find features starting with * 
            // defined as: * Name • Source \n Description
            const featureRegex = /\* (.*?) • (.*?)\n([\s\S]*?)(?=\n\* |\n===|$)/g;
            let match;

            while ((match = featureRegex.exec(traitText)) !== null) {
                const name = match[1].trim();
                const source = match[2].trim();
                const desc = match[3].trim();

                d.features.push({
                    name: name,
                    desc: `${desc} (${source})`
                });
            }

            // Also capture "=== SECTION HEADER ===" as a feature if needed, 
            // or perform a simpler split if the regex misses things.
            // For now, let's verify if this regex catches the user's example.
        }

        // Refresh UI first (Push Data -> DOM)
        if (typeof window.populateUI === 'function') {
            window.populateUI();
        } else if (typeof window.init === 'function') {
            window.init();
        }

        // Then Save (Persist DOM/Data to Storage)
        if (typeof window.save === 'function') {
            window.save();
        }
    }
};

// Auto-init if needed, or wait for DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    Importer.init();
});
