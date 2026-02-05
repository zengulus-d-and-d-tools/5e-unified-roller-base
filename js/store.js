(function (global) {
    const STORE_KEY = 'ravnica_unified_v1';
    const LEGACY_HUB_KEY = 'ravnicaHubV3_2';
    const LEGACY_BOARD_KEY = 'invBoardData';

    const createDefaultHQState = () => {
        const baseId = 'floor_' + Math.random().toString(36).slice(2, 7);
        return {
            grid: { cols: 26, rows: 18, cell: 48 },
            snapToGrid: true,
            floors: [{ id: baseId, name: 'Street Level', rooms: [] }],
            activeFloorId: baseId
        };
    };

    const DEFAULT_STATE = {
        meta: { version: 1, created: Date.now() },
        campaign: {
            rep: { "Azorius": 0, "Boros": 0, "Dimir": 0, "Golgari": 0, "Gruul": 0, "Izzet": 0, "Orzhov": 0, "Rakdos": 0, "Selesnya": 0, "Simic": 0 },
            heat: 0,
            players: [],
            npcs: [],
            locations: [],
            requisitions: [],
            events: [],
            encounters: [],
            case: { title: "", guilds: "", goal: "", clock: "", obstacles: "", setPiece: "" }
        },
        board: {
            name: "UNNAMED CASE",
            nodes: [],
            connections: []
        },
        hq: createDefaultHQState()
    };

    class Store {
        constructor() {
            this.state = JSON.parse(JSON.stringify(DEFAULT_STATE)); // Deep copy
            this.load();
        }

        load() {
            try {
                const raw = localStorage.getItem(STORE_KEY);
                if (raw) {
                    const loaded = JSON.parse(raw);
                    // Merge loaded state with default to ensure structural integrity
                    this.state = { ...this.state, ...loaded };
                    // Ensure deep objects exist
                    if (!this.state.campaign) this.state.campaign = { ...DEFAULT_STATE.campaign };
                    if (!this.state.board) this.state.board = { ...DEFAULT_STATE.board };
                    // Ensure arrays exist
                    if (!this.state.campaign.npcs) this.state.campaign.npcs = [];
                    if (!this.state.campaign.locations) this.state.campaign.locations = [];
                    if (!this.state.campaign.requisitions) this.state.campaign.requisitions = [];
                    if (!this.state.campaign.events) this.state.campaign.events = [];
                    if (!this.state.campaign.encounters) this.state.campaign.encounters = [];
                    if (!this.state.hq) this.state.hq = createDefaultHQState();

                    console.log("RTF_STORE: Loaded unified data.");
                } else {
                    console.log("RTF_STORE: No unified data found. Attempting migration...");
                    this.migrate();
                }
                if (!this.state.hq) this.state.hq = createDefaultHQState();
                this.ingestPreloadedData();
            } catch (e) {
                console.error("RTF_STORE: Load failed", e);
            }
        }

        ingestPreloadedData() {
            // Seed NPCs
            if (window.PRELOADED_NPCS && Array.isArray(window.PRELOADED_NPCS)) {
                const existingNames = new Set(this.state.campaign.npcs.map(n => n.name));
                let count = 0;
                window.PRELOADED_NPCS.forEach(n => {
                    if (!existingNames.has(n.name)) {
                        this.state.campaign.npcs.push({ ...n }); // Copy to avoid ref issues
                        existingNames.add(n.name);
                        count++;
                    }
                });
                if (count > 0) console.log(`RTF_STORE: Seeded ${count} NPCs.`);
            }

            // Seed Locations
            if (window.PRELOADED_LOCATIONS && Array.isArray(window.PRELOADED_LOCATIONS)) {
                const existingNames = new Set(this.state.campaign.locations.map(l => l.name));
                let count = 0;
                window.PRELOADED_LOCATIONS.forEach(l => {
                    if (!existingNames.has(l.name)) {
                        this.state.campaign.locations.push({ ...l });
                        existingNames.add(l.name);
                        count++;
                    }
                });
                if (count > 0) console.log(`RTF_STORE: Seeded ${count} Locations.`);
            }
        }

        save() {
            try {
                this.state.meta.updated = Date.now();
                localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
                // console.log("RTF_STORE: Saved.");
            } catch (e) {
                console.error("RTF_STORE: Save failed", e);
            }
        }

        migrate() {
            let migrated = false;

            // 1. Migrate Hub Data
            const hubRaw = localStorage.getItem(LEGACY_HUB_KEY);
            if (hubRaw) {
                try {
                    const hubData = JSON.parse(hubRaw);
                    if (hubData.rep) this.state.campaign.rep = hubData.rep;
                    if (hubData.heat) this.state.campaign.heat = hubData.heat;
                    if (hubData.players) this.state.campaign.players = hubData.players;
                    if (hubData.case) this.state.campaign.case = hubData.case;
                    console.log("RTF_STORE: Migrated Hub data.");
                    migrated = true;
                } catch (e) { console.warn("Migration error (Hub):", e); }
            }

            // 2. Migrate Board Data
            const boardRaw = localStorage.getItem(LEGACY_BOARD_KEY);
            if (boardRaw) {
                try {
                    const boardData = JSON.parse(boardRaw);
                    if (boardData.name) this.state.board.name = boardData.name;
                    if (boardData.nodes) this.state.board.nodes = boardData.nodes;
                    if (boardData.connections) this.state.board.connections = boardData.connections;
                    console.log("RTF_STORE: Migrated Board data.");
                    migrated = true;
                } catch (e) { console.warn("Migration error (Board):", e); }
            }

            if (migrated) {
                this.save();
                // Optional: Clear legacy data? 
                // localStorage.removeItem(LEGACY_HUB_KEY);
                // localStorage.removeItem(LEGACY_BOARD_KEY);
            }
        }

        export() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state));
            const downloadAnchorNode = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `ravnica_unified_backup_${date}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }

        import() {
            return new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = event => {
                        try {
                            const loaded = JSON.parse(event.target.result);
                            if (loaded.meta && loaded.campaign && loaded.board) {
                                this.state = loaded;
                                this.save();
                                resolve(true);
                            } else {
                                alert("Invalid format: Missing campaign or board data.");
                                resolve(false);
                            }
                        } catch (err) {
                            console.error(err);
                            alert("Invalid JSON file");
                            resolve(false);
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            });
        }

        // --- Helper Accessors ---
        addPlayer(player) {
            this.state.campaign.players.push(player);
            this.save();
        }

        addNPC(npc) {
            this.state.campaign.npcs.push(npc);
            this.save();
        }

        getPlayers() { return this.state.campaign.players || []; }
        getNPCs() { return this.state.campaign.npcs || []; }

        // Requisitions
        getRequisitions() { return this.state.campaign.requisitions || []; }
        addRequisition(req) {
            if (!req.id) req.id = 'req_' + Date.now();
            this.getRequisitions().push(req);
            this.save();
            return req.id;
        }
        updateRequisition(id, updates) {
            const list = this.getRequisitions();
            const idx = list.findIndex(r => r.id === id);
            if (idx >= 0) {
                list[idx] = { ...list[idx], ...updates };
                this.save();
            }
        }
        deleteRequisition(id) {
            const list = this.getRequisitions();
            const idx = list.findIndex(r => r.id === id);
            if (idx >= 0) {
                list.splice(idx, 1);
                this.save();
            }
        }

        // Mission Events
        getEvents() { return this.state.campaign.events || []; }
        addEvent(evt) {
            if (!evt.id) evt.id = 'event_' + Date.now();
            this.getEvents().push(evt);
            this.save();
            return evt.id;
        }
        updateEvent(id, updates) {
            const list = this.getEvents();
            const idx = list.findIndex(e => e.id === id);
            if (idx >= 0) {
                list[idx] = { ...list[idx], ...updates };
                this.save();
            }
        }
        deleteEvent(id) {
            const list = this.getEvents();
            const idx = list.findIndex(e => e.id === id);
            if (idx >= 0) {
                list.splice(idx, 1);
                this.save();
            }
        }

        // Encounter Recipes
        getEncounters() { return this.state.campaign.encounters || []; }
        addEncounter(enc) {
            if (!enc.id) enc.id = 'enc_' + Date.now();
            this.getEncounters().push(enc);
            this.save();
            return enc.id;
        }
        updateEncounter(id, updates) {
            const list = this.getEncounters();
            const idx = list.findIndex(e => e.id === id);
            if (idx >= 0) {
                list[idx] = { ...list[idx], ...updates };
                this.save();
            }
        }
        deleteEncounter(id) {
            const list = this.getEncounters();
            const idx = list.findIndex(e => e.id === id);
            if (idx >= 0) {
                list.splice(idx, 1);
                this.save();
            }
        }

        getHQLayout() {
            if (!this.state.hq) this.state.hq = createDefaultHQState();
            return JSON.parse(JSON.stringify(this.state.hq));
        }

        updateHQLayout(hqState) {
            this.state.hq = hqState;
            this.save();
        }
    }

    global.RTF_STORE = new Store();

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
