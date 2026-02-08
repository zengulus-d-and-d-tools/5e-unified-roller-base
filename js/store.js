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

    const deepClone = (value) => JSON.parse(JSON.stringify(value));
    const toNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const toNonNegativeInt = (value, fallback = 0) => {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(0, parsed);
    };

    const sanitizeCase = (caseData) => {
        const base = DEFAULT_STATE.campaign.case;
        const source = caseData && typeof caseData === 'object' ? caseData : {};
        return {
            title: typeof source.title === 'string' ? source.title : base.title,
            guilds: typeof source.guilds === 'string' ? source.guilds : base.guilds,
            goal: typeof source.goal === 'string' ? source.goal : base.goal,
            clock: typeof source.clock === 'string' ? source.clock : base.clock,
            obstacles: typeof source.obstacles === 'string' ? source.obstacles : base.obstacles,
            setPiece: typeof source.setPiece === 'string' ? source.setPiece : base.setPiece
        };
    };

    const sanitizeRep = (rep) => {
        const normalized = { ...DEFAULT_STATE.campaign.rep };
        if (!rep || typeof rep !== 'object') return normalized;
        Object.keys(normalized).forEach((guild) => {
            normalized[guild] = toNumber(rep[guild], 0);
        });
        return normalized;
    };

    const sanitizeCampaign = (campaign) => {
        const source = campaign && typeof campaign === 'object' ? campaign : {};
        return {
            rep: sanitizeRep(source.rep),
            heat: toNumber(source.heat, 0),
            players: Array.isArray(source.players) ? source.players : [],
            npcs: Array.isArray(source.npcs) ? source.npcs : [],
            locations: Array.isArray(source.locations) ? source.locations : [],
            requisitions: Array.isArray(source.requisitions) ? source.requisitions : [],
            events: Array.isArray(source.events) ? source.events : [],
            encounters: Array.isArray(source.encounters) ? source.encounters : [],
            case: sanitizeCase(source.case)
        };
    };

    const sanitizeBoard = (board) => {
        const source = board && typeof board === 'object' ? board : {};
        return {
            name: typeof source.name === 'string' && source.name ? source.name : DEFAULT_STATE.board.name,
            nodes: Array.isArray(source.nodes) ? source.nodes : [],
            connections: Array.isArray(source.connections) ? source.connections : []
        };
    };

    const sanitizeHQ = (hq) => {
        const base = createDefaultHQState();
        const source = hq && typeof hq === 'object' ? hq : {};
        const gridSource = source.grid && typeof source.grid === 'object' ? source.grid : {};
        const grid = {
            cols: Math.max(6, toNonNegativeInt(gridSource.cols, base.grid.cols)),
            rows: Math.max(6, toNonNegativeInt(gridSource.rows, base.grid.rows)),
            cell: Math.max(24, toNonNegativeInt(gridSource.cell, base.grid.cell))
        };

        const floors = Array.isArray(source.floors)
            ? source.floors
                .filter(floor => floor && typeof floor === 'object')
                .map((floor, idx) => ({
                    id: (typeof floor.id === 'string' && floor.id) ? floor.id : `floor_${idx}_${Math.random().toString(36).slice(2, 7)}`,
                    name: (typeof floor.name === 'string' && floor.name) ? floor.name : `Level ${idx + 1}`,
                    rooms: Array.isArray(floor.rooms) ? floor.rooms : []
                }))
            : deepClone(base.floors);

        if (!floors.length) floors.push(...deepClone(base.floors));
        const activeFloorId = floors.some(f => f.id === source.activeFloorId) ? source.activeFloorId : floors[0].id;
        const maxJuniorOperatives = toNonNegativeInt(source.maxJuniorOperatives, 0);

        return {
            grid,
            snapToGrid: source.snapToGrid !== undefined ? !!source.snapToGrid : base.snapToGrid,
            floors,
            activeFloorId,
            maxJuniorOperatives
        };
    };

    const sanitizeState = (state) => {
        const source = state && typeof state === 'object' ? state : {};
        const defaultMeta = deepClone(DEFAULT_STATE.meta);
        const sourceMeta = source.meta && typeof source.meta === 'object' ? source.meta : {};
        const version = toNonNegativeInt(sourceMeta.version, 1) || 1;
        return {
            meta: { ...defaultMeta, ...sourceMeta, version },
            campaign: sanitizeCampaign(source.campaign),
            board: sanitizeBoard(source.board),
            hq: sanitizeHQ(source.hq)
        };
    };

    class Store {
        constructor() {
            this.state = deepClone(DEFAULT_STATE);
            this.load();
        }

        load() {
            try {
                const raw = localStorage.getItem(STORE_KEY);
                if (raw) {
                    const loaded = JSON.parse(raw);
                    this.state = sanitizeState(loaded);
                    console.log("RTF_STORE: Loaded unified data.");
                } else {
                    console.log("RTF_STORE: No unified data found. Attempting migration...");
                    this.migrate();
                }

                this.state = sanitizeState(this.state);
                this.ensurePlayerIds();
                if (this.ingestPreloadedData()) this.save();
            } catch (e) {
                console.error("RTF_STORE: Load failed", e);
                this.state = sanitizeState(null);
            }
        }

        ingestPreloadedData() {
            let changed = false;

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
                if (count > 0) {
                    console.log(`RTF_STORE: Seeded ${count} NPCs.`);
                    changed = true;
                }
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
                if (count > 0) {
                    console.log(`RTF_STORE: Seeded ${count} Locations.`);
                    changed = true;
                }
            }

            return changed;
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
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = e => {
                    const file = e.target.files[0];
                    if (!file) {
                        resolve(false);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = event => {
                        try {
                            const loaded = JSON.parse(event.target.result);
                            if (!loaded || typeof loaded !== 'object') {
                                alert("Invalid format: Expected JSON object.");
                                resolve(false);
                                return;
                            }

                            const hasKnownRoot = ['meta', 'campaign', 'board', 'hq'].some(key => Object.prototype.hasOwnProperty.call(loaded, key));
                            if (!hasKnownRoot) {
                                alert("Invalid format: Missing campaign or board data.");
                                resolve(false);
                                return;
                            }

                            this.state = sanitizeState(loaded);
                            this.ensurePlayerIds();
                            this.save();
                            resolve(true);
                        } catch (err) {
                            console.error(err);
                            alert("Invalid JSON file");
                            resolve(false);
                        }
                    };
                    reader.onerror = () => {
                        alert("File reading failed.");
                        resolve(false);
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

        ensurePlayerIds() {
            if (!this.state.campaign || !Array.isArray(this.state.campaign.players)) return;
            let mutated = false;
            this.state.campaign.players.forEach((p, idx) => {
                if (!p.id) {
                    p.id = 'player_' + Date.now().toString(36) + '_' + idx + Math.random().toString(36).slice(2, 5);
                    mutated = true;
                }
            });
            if (mutated) {
                try {
                    this.save();
                } catch (err) {
                    console.warn('RTF_STORE: Failed to persist player IDs', err);
                }
            }
        }

        getPlayers() {
            if (!this.state.campaign.players) this.state.campaign.players = [];
            return this.state.campaign.players;
        }
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

        getBoard() {
            this.state.board = sanitizeBoard(this.state.board);
            return this.state.board;
        }

        updateBoard(boardState) {
            this.state.board = sanitizeBoard(boardState);
            this.save();
        }

        clearBoard() {
            this.state.board = sanitizeBoard(null);
            this.save();
        }

        getHQLayout() {
            this.state.hq = sanitizeHQ(this.state.hq);
            return deepClone(this.state.hq);
        }

        updateHQLayout(hqState) {
            this.state.hq = sanitizeHQ(hqState);
            this.save();
        }
    }

    global.RTF_STORE = new Store();

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
