
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

    normalizeImportMode: function (mode) {
        return String(mode || '').toLowerCase() === 'spells' ? 'spells' : 'full';
    },

    // Trigger file selection
    triggerImport: function (mode) {
        if (!this.getPdfRuntime()) {
            console.error("Cannot import PDF: pdf.js runtime unavailable.");
            alert("PDF parser not loaded yet. Refresh and try again.");
            return;
        }

        const importMode = this.normalizeImportMode(mode);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = (e) => {
            const target = e && e.target ? e.target : null;
            const files = target && target.files ? target.files : null;
            if (files && files.length > 0) {
                this.processFile(files[0], importMode);
            }
        };
        input.click();
    },

    // Process the selected file
    processFile: async function (file, mode) {
        const importMode = this.normalizeImportMode(mode);
        this.debug(`Processing file: ${file.name}`, importMode);

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
            await this.applyToSheet(parsedData, importMode);

            if (importMode === 'spells') {
                alert("PDF Imported! Spells updated.");
            } else {
                alert("PDF Imported! Character sheet updated.");
            }

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

    normalizeFieldKey: function (fieldName) {
        return String(fieldName || '').replace(/[\s_-]+/g, '').toLowerCase();
    },

    parseSpellLevelFromLabel: function (rawValue) {
        const text = String(rawValue || '').toLowerCase();
        if (!text) return null;
        if (text.includes('cantrip') || text.includes('at will')) return 0;

        const patterns = [
            /([1-9])(?:st|nd|rd|th)\s*level/,
            /(?:^|[^a-z])level\s*([1-9])/,
            /(?:^|[^a-z])lvl\s*([1-9])/,
            /(?:^|[^a-z])([1-9])\s*lvl/
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (!match) continue;
            const parsed = parseInt(match[1], 10);
            if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 9) return parsed;
        }

        return null;
    },

    extractSpellLevelFromField: function (fieldName, value, fallbackLevel) {
        const source = `${fieldName || ''} ${value || ''}`.toLowerCase();
        if (/cantrip/.test(source)) return 0;

        const parsed = this.parseSpellLevelFromLabel(source);
        if (parsed !== null) return parsed;

        const safeFallback = parseInt(fallbackLevel, 10);
        if (Number.isFinite(safeFallback) && safeFallback >= 0 && safeFallback <= 9) return safeFallback;
        return 1;
    },

    getSpellNameFieldInfo: function (fieldName) {
        const normalized = this.normalizeFieldKey(fieldName);
        let match = normalized.match(/^spellname(\d+)$/);
        if (!match) {
            match = normalized.match(/^cantripname(\d+)$/);
        }
        if (!match) return null;
        const idx = parseInt(match[1], 10);
        if (!Number.isFinite(idx) || idx < 0) return null;
        return { index: idx, normalized };
    },

    isLikelySpellNameValue: function (rawValue) {
        const text = String(rawValue || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 180) return false;
        if (/^(o|p|--|n\/a)$/i.test(text)) return false;
        if (/^={2,}/.test(text)) return false;
        if (/^(at\s*will|\(at\s*will\))$/i.test(text)) return false;
        if (/^\+?-?\d+$/.test(text)) return false;
        if (/^slots?\b/i.test(text)) return false;
        if (/^phb\b/i.test(text)) return false;
        if (/^(v|s|m)([\/,\s]+(v|s|m))*$/i.test(text)) return false;
        if (/^d:\s*/i.test(text)) return false;
        if (/^(cleric|wizard|druid|bard|paladin|ranger|warlock|sorcerer|artificer)(\b|\s|\()/i.test(text)) return false;
        return true;
    },

    parseSpellSaveAttr: function (rawValue) {
        const text = String(rawValue || '').toUpperCase();
        const match = text.match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/);
        if (!match) return 'none';
        const map = {
            STR: 'str',
            DEX: 'dex',
            CON: 'con',
            INT: 'int',
            WIS: 'wis',
            CHA: 'cha'
        };
        return map[match[1]] || 'none';
    },

    parseSpellSlotCount: function (rawValue) {
        const text = String(rawValue || '').trim();
        if (!text) return null;
        const numeric = text.match(/(\d+)\s*slots?/i);
        if (numeric) {
            const parsed = parseInt(numeric[1], 10);
            if (Number.isFinite(parsed) && parsed >= 0) return Math.min(parsed, 20);
        }
        const bubbles = text.match(/\b[Oo]{1,20}\b/);
        if (bubbles) return bubbles[0].length;
        return null;
    },

    extractSpellbookEntries: function (pdfData) {
        if (!pdfData || typeof pdfData !== 'object') return [];
        const entries = [];
        const seen = new Set();
        const fieldMap = new Map();

        Object.entries(pdfData).forEach(([fieldName, rawValue]) => {
            fieldMap.set(this.normalizeFieldKey(fieldName), rawValue);
        });

        let activeLevel = 1;
        Object.entries(pdfData).forEach(([fieldName, rawValue]) => {
            const normalizedField = this.normalizeFieldKey(fieldName);
            if (/^spellheader\d+$/.test(normalizedField)) {
                const parsedLevel = this.parseSpellLevelFromLabel(rawValue);
                if (parsedLevel !== null) activeLevel = parsedLevel;
                return;
            }

            const nameFieldInfo = this.getSpellNameFieldInfo(fieldName);
            if (!nameFieldInfo) return;

            const cleanedName = String(rawValue || '')
                .replace(/\r\n/g, '\n')
                .replace(/\s+/g, ' ')
                .replace(/^[\*\-•]+/, '')
                .trim();
            if (!this.isLikelySpellNameValue(cleanedName)) return;

            const spellLevel = this.extractSpellLevelFromField(fieldName, cleanedName, activeLevel);
            const saveRaw = fieldMap.get(`spellsavehit${nameFieldInfo.index}`) ?? fieldMap.get(`savehit${nameFieldInfo.index}`);
            const notesRaw = fieldMap.get(`spellnotes${nameFieldInfo.index}`) ?? fieldMap.get(`notes${nameFieldInfo.index}`) ?? '';
            const safeNotes = String(notesRaw || '').trim();
            const dedupeKey = `${spellLevel}:${cleanedName.toLowerCase()}`;
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);

            entries.push({
                name: cleanedName.slice(0, 180),
                lvl: spellLevel,
                save: this.parseSpellSaveAttr(saveRaw),
                notes: safeNotes.length <= 5000 ? safeNotes : safeNotes.slice(0, 5000)
            });
        });

        return entries.slice(0, 300);
    },

    extractSpellSlots: function (pdfData, currentSlots) {
        if (!pdfData || typeof pdfData !== 'object') return null;
        const slots = Array.isArray(currentSlots) && currentSlots.length > 0
            ? currentSlots.map((slot, idx) => ({
                lvl: idx + 1,
                max: Math.max(0, parseInt(slot && slot.max, 10) || 0),
                used: Math.max(0, parseInt(slot && slot.used, 10) || 0)
            }))
            : Array.from({ length: 9 }, (_, idx) => ({ lvl: idx + 1, max: 0, used: 0 }));

        const sectionLevelMap = new Map();
        Object.entries(pdfData).forEach(([fieldName, rawValue]) => {
            const normalized = this.normalizeFieldKey(fieldName);
            const match = normalized.match(/^spellheader(\d+)$/);
            if (!match) return;
            const sectionIdx = parseInt(match[1], 10);
            if (!Number.isFinite(sectionIdx)) return;
            const parsedLevel = this.parseSpellLevelFromLabel(rawValue);
            if (parsedLevel !== null) sectionLevelMap.set(sectionIdx, parsedLevel);
        });

        let updated = false;
        Object.entries(pdfData).forEach(([fieldName, rawValue]) => {
            const normalized = this.normalizeFieldKey(fieldName);
            const match = normalized.match(/^spellslotheader(\d+)$/);
            if (!match) return;

            const sectionIdx = parseInt(match[1], 10);
            if (!Number.isFinite(sectionIdx)) return;
            const parsedMax = this.parseSpellSlotCount(rawValue);
            if (!Number.isFinite(parsedMax)) return;

            const sectionLevel = sectionLevelMap.has(sectionIdx)
                ? sectionLevelMap.get(sectionIdx)
                : this.parseSpellLevelFromLabel(rawValue);
            if (!Number.isFinite(sectionLevel) || sectionLevel < 1 || sectionLevel > 9) return;

            const slotIndex = sectionLevel - 1;
            if (!slots[slotIndex]) {
                slots[slotIndex] = { lvl: sectionLevel, max: 0, used: 0 };
            }
            const prevUsed = Math.max(0, parseInt(slots[slotIndex].used, 10) || 0);
            slots[slotIndex].max = parsedMax;
            slots[slotIndex].used = Math.min(prevUsed, parsedMax);
            updated = true;
        });

        return updated ? slots.slice(0, 9) : null;
    },

    extractSpellcastingMeta: function (pdfData, d) {
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

        return {
            spellAttr: importedSpellAttr,
            spellDc: importedSpellDc
        };
    },

    applySpellImportData: async function (pdfData, d) {
        const spellMeta = this.extractSpellcastingMeta(pdfData, d);
        if (spellMeta.spellAttr) d.meta.spellAttr = spellMeta.spellAttr;

        let importedSpellbook = this.extractSpellbookEntries(pdfData);
        if (importedSpellbook.length > 0 && typeof window.matchSpellbookEntriesByName === 'function') {
            try {
                importedSpellbook = await window.matchSpellbookEntriesByName(importedSpellbook);
            } catch (err) {
                console.warn('Spell name matching against SRD failed during import.', err);
            }
        } else if (importedSpellbook.length > 0 && typeof window.sanitizeSpellbookEntry === 'function') {
            importedSpellbook = importedSpellbook.map((entry) => window.sanitizeSpellbookEntry(entry));
        }

        if (importedSpellbook.length > 0) {
            d.spellbook = importedSpellbook;
        }

        const importedSlots = this.extractSpellSlots(pdfData, d.spells);
        if (importedSlots) {
            d.spells = importedSlots;
        }

        this.debug(`Spell import summary: ${importedSpellbook.length} spells${importedSlots ? ', slots updated' : ''}.`);
    },

    refreshAndSave: function () {
        if (typeof window.populateUI === 'function') {
            window.populateUI();
        } else if (typeof window.init === 'function') {
            window.init();
        }

        if (typeof window.save === 'function') {
            window.save();
        }
    },

    // Map extracted PDF data to the application's data structure
    applyToSheet: async function (pdfData, mode) {
        if (typeof window.data === 'undefined' || typeof window.save !== 'function') {
            console.error("Application data not found. Cannot apply import.");
            return;
        }

        const importMode = this.normalizeImportMode(mode);
        const d = window.data;
        this.debug("Applying data to sheet...", importMode, pdfData);

        if (importMode === 'spells') {
            await this.applySpellImportData(pdfData, d);
            this.refreshAndSave();
            return;
        }

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
        await this.applySpellImportData(pdfData, d);

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

        this.refreshAndSave();
    }
};

if (typeof globalThis !== 'undefined') {
    globalThis.Importer = Importer;
}

// Auto-init if needed, or wait for DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    Importer.init();
});
