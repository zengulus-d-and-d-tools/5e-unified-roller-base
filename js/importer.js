
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

    getPdfRuntime: function () {
        if (typeof globalThis === 'undefined') return null;
        const runtime = globalThis.pdfjsLib;
        if (!runtime || typeof runtime.getDocument !== 'function') return null;
        return runtime;
    },

    setWorkerSrc: function (runtime, workerSrc) {
        if (!runtime || !runtime.GlobalWorkerOptions) return;
        runtime.GlobalWorkerOptions.workerSrc = workerSrc;
    },

    // Entry point
    init: function () {
        this.debug("Importer initialized");
        const runtime = this.getPdfRuntime();
        if (runtime) {
            // Prefer a local worker when present; if unavailable, runtime falls back below.
            if (this.LOCAL_WORKER_CANDIDATES.length) {
                this.setWorkerSrc(runtime, this.LOCAL_WORKER_CANDIDATES[0]);
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
        const runtime = this.getPdfRuntime();

        if (!runtime) {
            throw new Error('pdf.js runtime unavailable.');
        }

        // pdf.js may transfer/detach the provided buffer when worker loading fails.
        // Keep an immutable source copy and clone for each attempt.
        const sourceBytes = new Uint8Array(arrayBuffer.slice(0));
        const createAttemptData = () => new Uint8Array(sourceBytes);

        for (const workerSrc of candidates) {
            try {
                this.setWorkerSrc(runtime, workerSrc);
                const loadingTask = runtime.getDocument({ data: createAttemptData() });
                return await loadingTask.promise;
            } catch (error) {
                lastError = error;
                console.warn(`PDF worker attempt failed (${workerSrc})`, error);
            }
        }

        // Final fallback for builds that can run in "fake worker" mode.
        try {
            this.setWorkerSrc(runtime, '');
            const loadingTask = runtime.getDocument({ data: createAttemptData(), disableWorker: true });
            return await loadingTask.promise;
        } catch (error) {
            lastError = error;
        }

        throw lastError || new Error("Unable to initialize PDF parser.");
    },

    // Trigger file selection
    triggerImport: function () {
        if (!this.getPdfRuntime()) {
            console.error("Cannot import PDF: pdf.js runtime unavailable.");
            alert("PDF parser not loaded yet. Refresh and try again.");
            return;
        }

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

    parseProficiencyMarker: function (marker) {
        if (marker === null || marker === undefined) return 0;
        const raw = String(marker).trim();
        if (!raw) return 0;
        const upper = raw.toUpperCase();

        if (upper === 'E' || upper === 'EXPERTISE' || /\bE\b/.test(upper) || upper.includes('EXPERT')) {
            return 2;
        }
        if (upper === 'P' || upper === 'PROFICIENT' || /\bP\b/.test(upper) || upper.includes('PROF') || raw.includes('•')) {
            return 1;
        }
        return 0;
    },

    parseSpellcastingAbility: function (rawValue) {
        if (rawValue === null || rawValue === undefined) return null;
        const raw = String(rawValue).trim();
        if (!raw) return null;
        const upper = raw.toUpperCase();
        const explicit = {
            STR: 'str',
            DEX: 'dex',
            CON: 'con',
            INT: 'int',
            WIS: 'wis',
            CHA: 'cha',
            STRENGTH: 'str',
            DEXTERITY: 'dex',
            CONSTITUTION: 'con',
            INTELLIGENCE: 'int',
            WISDOM: 'wis',
            CHARISMA: 'cha'
        };
        if (explicit[upper]) return explicit[upper];
        const token = upper.match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/);
        if (token && explicit[token[1]]) return explicit[token[1]];
        if (upper.includes('STRENGTH')) return 'str';
        if (upper.includes('DEXTERITY')) return 'dex';
        if (upper.includes('CONSTITUTION')) return 'con';
        if (upper.includes('INTELLIGENCE')) return 'int';
        if (upper.includes('WISDOM')) return 'wis';
        if (upper.includes('CHARISMA')) return 'cha';
        return null;
    },

    inferSpellcastingAbilityFromDc: function (rawDc, d) {
        const dc = parseInt(rawDc, 10);
        if (!Number.isFinite(dc)) return null;
        const level = Math.max(1, Math.min(20, parseInt(d && d.meta ? d.meta.level : 1, 10) || 1));
        const pb = Math.ceil(level / 4) + 1;
        const candidates = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

        let best = null;
        let bestDiff = Infinity;
        candidates.forEach((stat) => {
            const score = d && d.stats && d.stats[stat] ? parseInt(d.stats[stat].val, 10) : 10;
            const mod = Math.floor(((Number.isFinite(score) ? score : 10) - 10) / 2);
            const projectedDc = 8 + pb + mod;
            const diff = Math.abs(projectedDc - dc);
            if (diff < bestDiff) {
                best = stat;
                bestDiff = diff;
            }
        });
        return bestDiff <= 1 ? best : null;
    },

    extractSpellLevelFromField: function (fieldName, value) {
        const source = `${fieldName || ''} ${value || ''}`.toLowerCase();
        if (/cantrip/.test(source)) return 0;

        const levelPatterns = [
            /(?:^|[^a-z])(level|lvl)\s*([1-9])/,
            /([1-9])(?:st|nd|rd|th)\s*level/,
            /(?:^|[^a-z])([1-9])\s*lvl/,
            /spell\s*level\s*([1-9])/
        ];

        for (const pattern of levelPatterns) {
            const match = source.match(pattern);
            if (match) {
                const valuePart = parseInt(match[2] || match[1], 10);
                if (Number.isFinite(valuePart) && valuePart >= 1 && valuePart <= 9) return valuePart;
            }
        }

        return 1;
    },

    isLikelySpellNameField: function (fieldName) {
        const key = String(fieldName || '').toLowerCase();
        if (!/(spell|cantrip)/.test(key)) return false;
        if (/(spell\s*save|spell\s*attack|spellcasting|slot|prepared|slots|class|ability|dc)/.test(key)) return false;
        if (/(description|desc|range|duration|component|damage|notes?|time|ritual|concentration)/.test(key)) return false;
        return true;
    },

    extractSpellbookEntries: function (pdfData) {
        if (!pdfData || typeof pdfData !== 'object') return [];
        const entries = [];
        const seen = new Set();

        Object.entries(pdfData).forEach(([fieldName, rawValue]) => {
            if (!this.isLikelySpellNameField(fieldName)) return;
            if (rawValue === null || rawValue === undefined) return;

            const text = String(rawValue).replace(/\r\n/g, '\n').trim();
            if (!text) return;

            const level = this.extractSpellLevelFromField(fieldName, text);
            const candidates = text
                .split(/\n|,|;/)
                .map(part => part.trim())
                .filter(Boolean);

            candidates.forEach((candidate) => {
                if (!candidate) return;
                if (candidate.length > 180) return;
                if (/^\d+$/.test(candidate)) return;
                const cleaned = candidate
                    .replace(/\s{2,}/g, ' ')
                    .replace(/^[\*\-•]+/, '')
                    .trim();
                if (!cleaned) return;
                const dedupeKey = `${level}:${cleaned.toLowerCase()}`;
                if (seen.has(dedupeKey)) return;
                seen.add(dedupeKey);
                entries.push({
                    name: cleaned.slice(0, 180),
                    lvl: level,
                    save: 'none',
                    notes: ''
                });
            });
        });

        return entries.slice(0, 250);
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

        let importedSpellAttr = null;
        let importedSpellDc = null;
        for (const [fieldName, fieldValue] of Object.entries(pdfData)) {
            const key = String(fieldName || '').toLowerCase();
            if (!importedSpellAttr && /spellcasting.*abil|spell\s*ability|spellcastingability/.test(key)) {
                importedSpellAttr = this.parseSpellcastingAbility(fieldValue);
            }
            if (importedSpellDc === null && /spell\s*save\s*dc/.test(key)) {
                const parsedDc = parseInt(fieldValue, 10);
                if (Number.isFinite(parsedDc)) importedSpellDc = parsedDc;
            }
        }
        if (!importedSpellAttr && importedSpellDc !== null) {
            importedSpellAttr = this.inferSpellcastingAbilityFromDc(importedSpellDc, d);
        }
        if (importedSpellAttr) d.meta.spellAttr = importedSpellAttr;

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
            const profLevel = this.parseProficiencyMarker(pdfData[pdfKey]);
            if (profLevel > 0) {
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
            const profLevel = this.parseProficiencyMarker(pdfData[profKey]);
            if (profLevel > 0) {
                d.skills[sheetKey] = Math.max(d.skills[sheetKey] || 0, profLevel);
            }
        }

        // --- SPELLBOOK ---
        const importedSpellbook = this.extractSpellbookEntries(pdfData);
        if (importedSpellbook.length > 0) {
            d.spellbook = importedSpellbook;
            this.debug(`Imported ${importedSpellbook.length} spells.`);
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

if (typeof globalThis !== 'undefined') {
    globalThis.Importer = Importer;
}

// Auto-init if needed, or wait for DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    Importer.init();
});
