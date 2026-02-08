(function (global) {
    const STORE_KEY = 'ravnica_unified_v1';
    const LEGACY_HUB_KEY = 'ravnicaHubV3_2';
    const LEGACY_BOARD_KEY = 'invBoardData';

    const SYNC_CONFIG_KEY = 'ravnica_sync_config_v1';
    const SYNC_STATUS_EVENT = 'rtf-sync-status';
    const STORE_UPDATED_EVENT = 'rtf-store-updated';
    const SUPABASE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

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

    const DEFAULT_SYNC_CONFIG = {
        enabled: false,
        autoConnect: true,
        supabaseUrl: '',
        anonKey: '',
        campaignId: '',
        profileName: '',
        schema: 'public',
        tableName: 'rtf_campaign_state',
        syncDelayMs: 900
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

    const toTimestamp = (value, fallback = 0) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            const parsed = Date.parse(value);
            if (Number.isFinite(parsed)) return parsed;
        }
        return fallback;
    };

    const sanitizeIdentifier = (value, fallback) => {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw) return fallback;
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return raw;
        return fallback;
    };

    const sanitizeCampaignId = (value) => {
        const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
        if (!raw) return '';
        return raw.replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 80);
    };

    const sanitizeProfileName = (value) => {
        const raw = typeof value === 'string' ? value.trim() : '';
        return raw.slice(0, 48);
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
        const created = toTimestamp(sourceMeta.created, defaultMeta.created);
        const updated = toTimestamp(sourceMeta.updated, 0);

        return {
            meta: { ...defaultMeta, ...sourceMeta, version, created, updated },
            campaign: sanitizeCampaign(source.campaign),
            board: sanitizeBoard(source.board),
            hq: sanitizeHQ(source.hq)
        };
    };

    const parseStoredSyncConfig = () => {
        try {
            const raw = localStorage.getItem(SYNC_CONFIG_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (err) {
            console.warn('RTF_STORE: Failed to parse sync config', err);
            return null;
        }
    };

    const sanitizeSyncConfig = (config) => {
        const source = config && typeof config === 'object' ? config : {};
        return {
            enabled: !!source.enabled,
            autoConnect: source.autoConnect !== false,
            supabaseUrl: typeof source.supabaseUrl === 'string' ? source.supabaseUrl.trim() : '',
            anonKey: typeof source.anonKey === 'string' ? source.anonKey.trim() : '',
            campaignId: sanitizeCampaignId(source.campaignId),
            profileName: sanitizeProfileName(source.profileName),
            schema: sanitizeIdentifier(source.schema, DEFAULT_SYNC_CONFIG.schema),
            tableName: sanitizeIdentifier(source.tableName, DEFAULT_SYNC_CONFIG.tableName),
            syncDelayMs: Math.max(250, toNonNegativeInt(source.syncDelayMs, DEFAULT_SYNC_CONFIG.syncDelayMs) || DEFAULT_SYNC_CONFIG.syncDelayMs)
        };
    };

    const getMergedSyncConfig = () => {
        const boot = global.RTF_SYNC_BOOTSTRAP && typeof global.RTF_SYNC_BOOTSTRAP === 'object' ? global.RTF_SYNC_BOOTSTRAP : null;
        const stored = parseStoredSyncConfig();
        return sanitizeSyncConfig({ ...DEFAULT_SYNC_CONFIG, ...(boot || {}), ...(stored || {}) });
    };

    class Store {
        constructor() {
            this.state = deepClone(DEFAULT_STATE);

            this.sync = {
                config: getMergedSyncConfig(),
                client: null,
                channel: null,
                clientKey: '',
                instanceId: 'client_' + Math.random().toString(36).slice(2, 10),
                pushTimer: null,
                pushInFlight: false,
                pushQueued: false,
                lastRemoteSeenAt: 0,
                lastPushAt: 0,
                lastPullAt: 0,
                userId: '',
                supabaseLoadPromise: null
            };

            this.isApplyingRemote = false;
            this.syncStatusListeners = new Set();

            this.syncStatus = {
                mode: this.sync.config.enabled ? 'idle' : 'disabled',
                message: this.sync.config.enabled ? 'Cloud sync is configured but not connected.' : 'Cloud sync is disabled.',
                enabled: this.sync.config.enabled,
                connected: false,
                campaignId: this.sync.config.campaignId,
                profileName: this.sync.config.profileName,
                userId: '',
                pendingPush: false,
                lastPushAt: null,
                lastPullAt: null,
                lastError: '',
                updatedAt: Date.now()
            };

            this.load();
            this.emitSyncStatus();

            if (this.sync.config.enabled && this.sync.config.autoConnect) {
                this.connectSync().catch((err) => {
                    this.updateSyncStatus({
                        mode: 'error',
                        connected: false,
                        message: 'Sync connect failed.',
                        lastError: err && err.message ? err.message : String(err)
                    });
                });
            }
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
                this.ensurePlayerIds(false);
                if (this.ingestPreloadedData()) this.save();
            } catch (e) {
                console.error("RTF_STORE: Load failed", e);
                this.state = sanitizeState(null);
            }
        }

        ingestPreloadedData() {
            let changed = false;

            if (window.PRELOADED_NPCS && Array.isArray(window.PRELOADED_NPCS)) {
                const existingNames = new Set(this.state.campaign.npcs.map(n => n.name));
                let count = 0;
                window.PRELOADED_NPCS.forEach(n => {
                    if (!existingNames.has(n.name)) {
                        this.state.campaign.npcs.push({ ...n });
                        existingNames.add(n.name);
                        count++;
                    }
                });
                if (count > 0) {
                    console.log(`RTF_STORE: Seeded ${count} NPCs.`);
                    changed = true;
                }
            }

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

        save(options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            const skipCloud = !!opts.skipCloud;
            const skipEvent = !!opts.skipEvent;

            try {
                this.state.meta.updated = Date.now();
                localStorage.setItem(STORE_KEY, JSON.stringify(this.state));

                if (!skipCloud && !this.isApplyingRemote) this.scheduleCloudPush('local-save');
                if (!skipEvent) this.broadcastStoreUpdate('local');
            } catch (e) {
                console.error("RTF_STORE: Save failed", e);
            }
        }

        migrate() {
            let migrated = false;

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
                } catch (e) {
                    console.warn("Migration error (Hub):", e);
                }
            }

            const boardRaw = localStorage.getItem(LEGACY_BOARD_KEY);
            if (boardRaw) {
                try {
                    const boardData = JSON.parse(boardRaw);
                    if (boardData.name) this.state.board.name = boardData.name;
                    if (boardData.nodes) this.state.board.nodes = boardData.nodes;
                    if (boardData.connections) this.state.board.connections = boardData.connections;
                    console.log("RTF_STORE: Migrated Board data.");
                    migrated = true;
                } catch (e) {
                    console.warn("Migration error (Board):", e);
                }
            }

            if (migrated) this.save();
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
                            this.ensurePlayerIds(false);
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

        // Sync Configuration + Status
        getSyncConfig() {
            return deepClone(this.sync.config);
        }

        setSyncConfig(configPatch, options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            const merge = opts.merge !== false;
            const reconnect = opts.reconnect !== false;

            const base = merge ? this.sync.config : DEFAULT_SYNC_CONFIG;
            const next = sanitizeSyncConfig({ ...base, ...(configPatch || {}) });

            this.sync.config = next;
            try {
                localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(next));
            } catch (err) {
                console.warn('RTF_STORE: Failed to persist sync config', err);
            }

            this.updateSyncStatus({
                enabled: next.enabled,
                campaignId: next.campaignId,
                profileName: next.profileName
            });

            if (reconnect) {
                if (next.enabled) {
                    this.connectSync().catch((err) => {
                        this.updateSyncStatus({
                            mode: 'error',
                            connected: false,
                            message: 'Sync connect failed.',
                            lastError: err && err.message ? err.message : String(err)
                        });
                    });
                } else {
                    this.disconnectSync('disabled').catch(() => { });
                }
            }

            return this.getSyncConfig();
        }

        clearSyncConfig(options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            const disconnect = opts.disconnect !== false;

            try {
                localStorage.removeItem(SYNC_CONFIG_KEY);
            } catch (err) {
                console.warn('RTF_STORE: Failed clearing sync config', err);
            }

            this.sync.config = sanitizeSyncConfig(DEFAULT_SYNC_CONFIG);
            this.updateSyncStatus({
                mode: 'disabled',
                enabled: false,
                connected: false,
                campaignId: '',
                profileName: '',
                message: 'Cloud sync is disabled.'
            });

            if (disconnect) {
                this.disconnectSync('disabled').catch(() => { });
            }
        }

        getSyncStatus() {
            return deepClone(this.syncStatus);
        }

        onSyncStatus(listener) {
            if (typeof listener !== 'function') return () => { };
            this.syncStatusListeners.add(listener);
            try {
                listener(this.getSyncStatus());
            } catch (err) {
                console.warn('RTF_STORE: sync status listener failed', err);
            }
            return () => {
                this.syncStatusListeners.delete(listener);
            };
        }

        emitSyncStatus() {
            const snap = this.getSyncStatus();
            this.syncStatusListeners.forEach((fn) => {
                try {
                    fn(snap);
                } catch (err) {
                    console.warn('RTF_STORE: sync status listener failed', err);
                }
            });

            if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
                global.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: snap }));
            }
        }

        updateSyncStatus(patch) {
            this.syncStatus = {
                ...this.syncStatus,
                ...(patch || {}),
                updatedAt: Date.now()
            };
            this.emitSyncStatus();
        }

        async loadSupabaseLibrary() {
            if (global.supabase && typeof global.supabase.createClient === 'function') {
                return global.supabase;
            }
            if (this.sync.supabaseLoadPromise) {
                return this.sync.supabaseLoadPromise;
            }

            this.sync.supabaseLoadPromise = new Promise((resolve, reject) => {
                if (!global.document || !document.head) {
                    reject(new Error('Document context unavailable.'));
                    return;
                }

                const onReady = () => {
                    if (global.supabase && typeof global.supabase.createClient === 'function') resolve(global.supabase);
                    else reject(new Error('Supabase client library not available after load.'));
                };

                const existing = document.querySelector('script[data-rtf-supabase="1"]');
                if (existing) {
                    if (global.supabase && typeof global.supabase.createClient === 'function') {
                        resolve(global.supabase);
                    } else {
                        existing.addEventListener('load', onReady, { once: true });
                        existing.addEventListener('error', () => reject(new Error('Failed to load Supabase library.')), { once: true });
                    }
                    return;
                }

                const script = document.createElement('script');
                script.src = SUPABASE_CDN_URL;
                script.async = true;
                script.dataset.rtfSupabase = '1';
                script.onload = onReady;
                script.onerror = () => reject(new Error('Failed to load Supabase library.'));
                document.head.appendChild(script);
            });

            return this.sync.supabaseLoadPromise;
        }

        async connectSync() {
            const config = this.sync.config;
            if (!config.enabled) {
                this.updateSyncStatus({
                    mode: 'disabled',
                    connected: false,
                    enabled: false,
                    message: 'Cloud sync is disabled.',
                    pendingPush: false
                });
                return { ok: false, reason: 'disabled' };
            }

            if (!config.supabaseUrl || !config.anonKey || !config.campaignId) {
                this.updateSyncStatus({
                    mode: 'error',
                    connected: false,
                    enabled: true,
                    message: 'Missing sync config: URL, anon key, or campaign ID.',
                    lastError: 'Missing required sync config.'
                });
                return { ok: false, reason: 'missing-config' };
            }

            this.updateSyncStatus({
                mode: 'connecting',
                enabled: true,
                connected: false,
                campaignId: config.campaignId,
                profileName: config.profileName,
                message: 'Connecting to Supabase...',
                lastError: ''
            });

            try {
                const supabaseLib = await this.loadSupabaseLibrary();
                const clientKey = `${config.supabaseUrl}|${config.anonKey}`;

                if (!this.sync.client || this.sync.clientKey !== clientKey) {
                    await this.disconnectSync('reconfigure');
                    this.sync.client = supabaseLib.createClient(config.supabaseUrl, config.anonKey, {
                        auth: {
                            persistSession: true,
                            autoRefreshToken: true,
                            detectSessionInUrl: true
                        }
                    });
                    this.sync.clientKey = clientKey;
                }

                const authResult = await this.ensureSyncUser();
                if (!authResult.ok) {
                    this.updateSyncStatus({
                        mode: 'auth_required',
                        connected: false,
                        userId: '',
                        message: authResult.message || 'Authentication required for sync.',
                        lastError: authResult.message || 'Authentication required.'
                    });
                    return { ok: false, reason: 'auth-required' };
                }

                this.sync.userId = authResult.userId || '';
                await this.subscribeRealtime();

                this.updateSyncStatus({
                    mode: 'ready',
                    connected: true,
                    userId: this.sync.userId,
                    message: 'Connected to cloud sync.'
                });

                const pull = await this.pullFromCloud({ force: false, silent: true });
                if (pull.ok && pull.applied) {
                    this.updateSyncStatus({ message: 'Connected. Pulled latest cloud state.' });
                }
                if (pull.ok && pull.reason === 'empty') {
                    this.scheduleCloudPush('seed-cloud');
                    this.updateSyncStatus({ message: 'Connected. No cloud row yet; pending first push.' });
                }

                return { ok: true };
            } catch (err) {
                const msg = err && err.message ? err.message : String(err);
                this.updateSyncStatus({
                    mode: 'error',
                    connected: false,
                    message: 'Failed to connect sync.',
                    lastError: msg
                });
                return { ok: false, reason: 'error', error: msg };
            }
        }

        async disconnectSync(reason = 'manual') {
            this.cancelCloudPush();

            if (this.sync.channel && this.sync.client) {
                try {
                    await this.sync.client.removeChannel(this.sync.channel);
                } catch (err) {
                    console.warn('RTF_STORE: Failed removing sync channel', err);
                }
            }
            this.sync.channel = null;
            this.sync.pushInFlight = false;
            this.sync.pushQueued = false;

            if (reason === 'disabled') {
                this.updateSyncStatus({
                    mode: 'disabled',
                    connected: false,
                    pendingPush: false,
                    message: 'Cloud sync is disabled.'
                });
            } else if (reason === 'manual') {
                this.updateSyncStatus({
                    mode: 'idle',
                    connected: false,
                    pendingPush: false,
                    message: 'Cloud sync disconnected.'
                });
            } else if (reason !== 'reconfigure') {
                this.updateSyncStatus({
                    mode: 'idle',
                    connected: false,
                    pendingPush: false
                });
            }
        }

        async ensureSyncUser() {
            if (!this.sync.client) return { ok: false, message: 'Supabase client unavailable.' };

            try {
                const sessionResult = await this.sync.client.auth.getSession();
                const existingSession = sessionResult && sessionResult.data ? sessionResult.data.session : null;
                if (existingSession && existingSession.user && existingSession.user.id) {
                    return { ok: true, userId: existingSession.user.id };
                }

                const anonResult = await this.sync.client.auth.signInAnonymously({
                    options: {
                        data: this.sync.config.profileName ? { profile_name: this.sync.config.profileName } : {}
                    }
                });

                if (anonResult.error) {
                    return {
                        ok: false,
                        message: anonResult.error.message || 'Anonymous auth failed.'
                    };
                }

                const session = anonResult.data ? anonResult.data.session : null;
                if (session && session.user && session.user.id) {
                    return { ok: true, userId: session.user.id };
                }

                return { ok: false, message: 'No authenticated user session.' };
            } catch (err) {
                return {
                    ok: false,
                    message: err && err.message ? err.message : 'Auth failed.'
                };
            }
        }

        async requestMagicLink(email) {
            if (!this.sync.client) return { ok: false, error: 'Supabase client unavailable.' };
            const cleanEmail = typeof email === 'string' ? email.trim() : '';
            if (!cleanEmail) return { ok: false, error: 'Email required.' };

            const options = {};
            if (global.location && global.location.href) {
                options.emailRedirectTo = global.location.href;
            }

            const result = await this.sync.client.auth.signInWithOtp({ email: cleanEmail, options });
            if (result.error) {
                return { ok: false, error: result.error.message || 'Magic link request failed.' };
            }

            return { ok: true };
        }

        async signInAnonymously(profileName = '') {
            const patch = {};
            const cleanName = sanitizeProfileName(profileName);
            if (cleanName) patch.profileName = cleanName;
            if (Object.keys(patch).length) this.setSyncConfig(patch, { reconnect: false });
            return this.connectSync();
        }

        async signOutSyncUser() {
            if (!this.sync.client) return { ok: false, error: 'Supabase client unavailable.' };
            const result = await this.sync.client.auth.signOut();
            await this.disconnectSync('manual');
            if (result.error) {
                return { ok: false, error: result.error.message || 'Sign out failed.' };
            }
            this.sync.userId = '';
            this.updateSyncStatus({
                mode: this.sync.config.enabled ? 'idle' : 'disabled',
                connected: false,
                userId: '',
                message: this.sync.config.enabled ? 'Signed out from cloud sync.' : 'Cloud sync is disabled.'
            });
            return { ok: true };
        }

        async subscribeRealtime() {
            if (!this.sync.client) throw new Error('Supabase client unavailable.');

            if (this.sync.channel) {
                try {
                    await this.sync.client.removeChannel(this.sync.channel);
                } catch (err) {
                    console.warn('RTF_STORE: Failed replacing sync channel', err);
                }
            }

            const config = this.sync.config;
            const channelName = `rtf-sync-${config.campaignId}-${this.sync.instanceId}`;
            const filter = `campaign_id=eq.${config.campaignId}`;
            const channel = this.sync.client.channel(channelName);

            channel.on('postgres_changes', {
                event: '*',
                schema: config.schema,
                table: config.tableName,
                filter
            }, (payload) => {
                this.handleRealtimePayload(payload);
            });

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Realtime subscription timed out.'));
                }, 10000);

                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        clearTimeout(timeout);
                        resolve();
                        return;
                    }
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        clearTimeout(timeout);
                        reject(new Error(`Realtime channel status: ${status}`));
                    }
                });
            });

            this.sync.channel = channel;
        }

        handleRealtimePayload(payload) {
            const row = payload && payload.new ? payload.new : null;
            if (!row || !row.state) return;

            const updatedAt = toTimestamp(row.updated_at, Date.now());
            const updatedBy = row.updated_by || '';

            if (updatedBy && updatedBy === this.sync.instanceId) return;
            if (updatedAt && updatedAt <= this.sync.lastRemoteSeenAt) return;

            this.sync.lastRemoteSeenAt = updatedAt;
            const applied = this.applyRemoteState(row.state, {
                source: 'realtime',
                updatedAt,
                updatedBy
            });

            if (applied) {
                this.updateSyncStatus({
                    mode: 'ready',
                    connected: true,
                    message: 'Remote update received.'
                });
            }
        }

        scheduleCloudPush(reason = 'scheduled') {
            if (!this.sync.config.enabled || !this.syncStatus.connected || !this.sync.client) return;

            if (this.sync.pushTimer) clearTimeout(this.sync.pushTimer);
            this.sync.pushTimer = setTimeout(() => {
                this.sync.pushTimer = null;
                this.pushToCloud({ reason, silent: true }).catch((err) => {
                    this.updateSyncStatus({
                        mode: 'error',
                        connected: false,
                        pendingPush: false,
                        message: 'Cloud push failed.',
                        lastError: err && err.message ? err.message : String(err)
                    });
                });
            }, this.sync.config.syncDelayMs);

            this.updateSyncStatus({
                pendingPush: true
            });
        }

        cancelCloudPush() {
            if (this.sync.pushTimer) {
                clearTimeout(this.sync.pushTimer);
                this.sync.pushTimer = null;
            }
            this.updateSyncStatus({ pendingPush: false });
        }

        async pullFromCloud(options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            const force = !!opts.force;
            const silent = !!opts.silent;

            if (!this.sync.client || !this.syncStatus.connected) {
                return { ok: false, reason: 'not-connected' };
            }

            const config = this.sync.config;
            const query = this.sync.client
                .from(config.tableName)
                .select('state,updated_at,updated_by')
                .eq('campaign_id', config.campaignId)
                .maybeSingle();

            const result = await query;
            if (result.error) {
                const code = result.error.code || '';
                if (code === 'PGRST116') {
                    return { ok: true, reason: 'empty', applied: false };
                }
                const message = result.error.message || 'Cloud pull failed.';
                if (!silent) {
                    this.updateSyncStatus({
                        mode: 'error',
                        lastError: message,
                        message: 'Cloud pull failed.'
                    });
                }
                return { ok: false, reason: 'error', error: message };
            }

            const row = result.data;
            if (!row || !row.state) {
                return { ok: true, reason: 'empty', applied: false };
            }

            const remoteUpdatedAt = toTimestamp(row.updated_at, 0);
            const localUpdatedAt = toTimestamp(this.state.meta.updated, 0);
            const shouldApply = force || remoteUpdatedAt > localUpdatedAt;

            if (!shouldApply) {
                if (localUpdatedAt > remoteUpdatedAt) {
                    this.scheduleCloudPush('catch-up');
                }
                this.sync.lastPullAt = Date.now();
                this.updateSyncStatus({
                    lastPullAt: this.sync.lastPullAt,
                    mode: 'ready',
                    connected: true,
                    pendingPush: false
                });
                return { ok: true, reason: 'up-to-date', applied: false };
            }

            const applied = this.applyRemoteState(row.state, {
                source: 'pull',
                updatedAt: remoteUpdatedAt,
                updatedBy: row.updated_by
            });

            if (applied) {
                this.sync.lastPullAt = Date.now();
                this.updateSyncStatus({
                    lastPullAt: this.sync.lastPullAt,
                    mode: 'ready',
                    connected: true,
                    pendingPush: false,
                    message: 'Pulled latest cloud state.'
                });
            }

            return { ok: true, reason: applied ? 'applied' : 'skipped', applied };
        }

        async pushToCloud(options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            const silent = !!opts.silent;

            if (!this.sync.client || !this.syncStatus.connected) {
                return { ok: false, reason: 'not-connected' };
            }

            if (this.sync.pushInFlight) {
                this.sync.pushQueued = true;
                this.updateSyncStatus({ pendingPush: true });
                return { ok: false, reason: 'queued' };
            }

            this.sync.pushInFlight = true;
            this.cancelCloudPush();

            try {
                const config = this.sync.config;
                const payloadState = sanitizeState(this.state);
                const updatedAt = Date.now();
                payloadState.meta.updated = updatedAt;

                this.state.meta.updated = updatedAt;
                try {
                    localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
                } catch (writeErr) {
                    console.warn('RTF_STORE: Failed updating local timestamp after cloud push', writeErr);
                }

                const row = {
                    campaign_id: config.campaignId,
                    state: payloadState,
                    updated_at: new Date(updatedAt).toISOString(),
                    updated_by: this.sync.instanceId,
                    updated_by_user: this.sync.userId || null,
                    updated_by_name: config.profileName || null
                };

                const result = await this.sync.client
                    .from(config.tableName)
                    .upsert(row, { onConflict: 'campaign_id' })
                    .select('updated_at,updated_by')
                    .single();

                if (result.error) {
                    const message = result.error.message || 'Cloud push failed.';
                    if (!silent) {
                        this.updateSyncStatus({
                            mode: 'error',
                            connected: false,
                            pendingPush: false,
                            message: 'Cloud push failed.',
                            lastError: message
                        });
                    }
                    return { ok: false, reason: 'error', error: message };
                }

                this.sync.lastPushAt = Date.now();
                const seenAt = toTimestamp(result.data && result.data.updated_at, this.sync.lastPushAt);
                if (seenAt > this.sync.lastRemoteSeenAt) this.sync.lastRemoteSeenAt = seenAt;

                this.updateSyncStatus({
                    mode: 'ready',
                    connected: true,
                    pendingPush: false,
                    lastPushAt: this.sync.lastPushAt,
                    message: 'Cloud sync updated.',
                    lastError: ''
                });

                return { ok: true };
            } catch (err) {
                const message = err && err.message ? err.message : String(err);
                if (!silent) {
                    this.updateSyncStatus({
                        mode: 'error',
                        connected: false,
                        pendingPush: false,
                        message: 'Cloud push failed.',
                        lastError: message
                    });
                }
                return { ok: false, reason: 'error', error: message };
            } finally {
                this.sync.pushInFlight = false;
                if (this.sync.pushQueued) {
                    this.sync.pushQueued = false;
                    this.scheduleCloudPush('queued');
                }
            }
        }

        applyRemoteState(remoteState, meta = {}) {
            const cleaned = sanitizeState(remoteState);
            const localUpdated = toTimestamp(this.state.meta.updated, 0);
            const remoteUpdated = toTimestamp(meta.updatedAt, toTimestamp(cleaned.meta.updated, Date.now()));

            if (!meta.force && remoteUpdated <= localUpdated) return false;

            this.isApplyingRemote = true;
            cleaned.meta.updated = remoteUpdated;
            this.state = cleaned;
            this.ensurePlayerIds(false);

            try {
                localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
            } catch (err) {
                console.error('RTF_STORE: Failed writing remote state locally', err);
            }

            this.isApplyingRemote = false;
            this.broadcastStoreUpdate('remote', {
                source: meta.source || 'remote',
                updatedAt: remoteUpdated,
                updatedBy: meta.updatedBy || ''
            });
            return true;
        }

        broadcastStoreUpdate(source = 'local', meta = {}) {
            const detail = {
                source,
                timestamp: Date.now(),
                ...(meta || {})
            };

            if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
                global.dispatchEvent(new CustomEvent(STORE_UPDATED_EVENT, { detail }));
            }

            if (source === 'remote') this.refreshKnownViews();
        }

        refreshKnownViews() {
            const handlers = ['render', 'renderRequisitions', 'renderTimeline', 'renderEncounters'];
            handlers.forEach((name) => {
                const fn = global[name];
                if (typeof fn === 'function') {
                    try {
                        fn();
                    } catch (err) {
                        console.warn(`RTF_STORE: failed refreshing ${name}`, err);
                    }
                }
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

        ensurePlayerIds(persist = true) {
            if (!this.state.campaign || !Array.isArray(this.state.campaign.players)) return;
            let mutated = false;
            this.state.campaign.players.forEach((p, idx) => {
                if (!p.id) {
                    p.id = 'player_' + Date.now().toString(36) + '_' + idx + Math.random().toString(36).slice(2, 5);
                    mutated = true;
                }
            });

            if (mutated && persist) {
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

        getNPCs() {
            return this.state.campaign.npcs || [];
        }

        // Requisitions
        getRequisitions() {
            return this.state.campaign.requisitions || [];
        }

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
        getEvents() {
            return this.state.campaign.events || [];
        }

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
        getEncounters() {
            return this.state.campaign.encounters || [];
        }

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
