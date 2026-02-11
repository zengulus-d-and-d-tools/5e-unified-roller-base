(function (global) {
    const STORE_KEY = 'ravnica_unified_v1';
    const LEGACY_HUB_KEY = 'ravnicaHubV3_2';
    const LEGACY_BOARD_KEY = 'invBoardData';

    const SYNC_CONFIG_KEY = 'ravnica_sync_config_v1';
    const SYNC_STATUS_EVENT = 'rtf-sync-status';
    const SYNC_CONFLICT_EVENT = 'rtf-sync-conflict';
    const STORE_UPDATED_EVENT = 'rtf-store-updated';
    const SUPABASE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    const STORE_DEBUG = false;

    const FALLBACK_GUILDS = [
        "Azorius",
        "Boros",
        "Dimir",
        "Golgari",
        "Gruul",
        "Izzet",
        "Orzhov",
        "Rakdos",
        "Selesnya",
        "Simic",
        "Guildless"
    ];

    const normalizeGuildName = (value) => String(value || '').trim();
    const logInfo = (...args) => {
        if (!STORE_DEBUG) return;
        console.log(...args);
    };

    const dedupeGuildNames = (source) => {
        const seen = new Set();
        const out = [];
        (Array.isArray(source) ? source : []).forEach((entry) => {
            const name = normalizeGuildName(entry);
            if (!name) return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            out.push(name);
        });
        return out;
    };

    const resolveDefaultGuildList = () => {
        if (typeof global.getRTFGuilds === 'function') {
            const byHelper = dedupeGuildNames(global.getRTFGuilds({ includeGuildless: true }));
            if (byHelper.length) return byHelper;
        }
        if (global.RTF_DATA && Array.isArray(global.RTF_DATA.guilds)) {
            const byData = dedupeGuildNames(global.RTF_DATA.guilds);
            if (byData.length) return byData;
        }
        if (Array.isArray(global.PRELOADED_GUILDS)) {
            const byPreload = dedupeGuildNames(global.PRELOADED_GUILDS);
            if (byPreload.length) return byPreload;
        }
        return FALLBACK_GUILDS.slice();
    };

    const buildRepMapFromGuilds = (guilds) => {
        const rep = Object.create(null);
        dedupeGuildNames(guilds).forEach((guild) => {
            if (guild === '__proto__' || guild === 'prototype' || guild === 'constructor') return;
            rep[guild] = 0;
        });
        if (!Object.keys(rep).length) rep[FALLBACK_GUILDS[0]] = 0;
        return rep;
    };

    const createDefaultHQState = () => {
        const baseId = 'floor_' + Math.random().toString(36).slice(2, 7);
        return {
            grid: { cols: 26, rows: 18, cell: 48 },
            snapToGrid: true,
            floors: [{ id: baseId, name: 'Street Level', rooms: [] }],
            activeFloorId: baseId
        };
    };

    const DEFAULT_BOARD_STATE = {
        name: "UNNAMED CASE",
        nodes: [],
        connections: []
    };
    const DEFAULT_CASE_NAME = 'Primary Case';
    const SYNC_SCOPE_GLOBAL = 'state';
    const SYNC_SCOPE_CASES_META = 'cases.meta';

    const DEFAULT_STATE = {
        meta: { version: 1, created: Date.now(), updated: 0, syncRevision: 0, scopeUpdated: {} },
        campaign: {
            rep: buildRepMapFromGuilds(resolveDefaultGuildList()),
            heat: 0,
            players: [],
            npcs: [],
            locations: [],
            requisitions: [],
            events: [],
            encounters: [],
            case: { title: "", guilds: "", goal: "", clock: "", obstacles: "", setPiece: "" }
        },
        board: { ...DEFAULT_BOARD_STATE },
        cases: {
            activeCaseId: 'case_primary',
            items: [
                {
                    id: 'case_primary',
                    name: DEFAULT_CASE_NAME,
                    board: { ...DEFAULT_BOARD_STATE },
                    events: []
                }
            ]
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
        syncDelayMs: 900,
        reconcileIntervalMs: 20000,
        presenceHeartbeatMs: 8000,
        lockTtlMs: 20000
    };

    const REQUISITION_STATUSES = new Set(['Pending', 'Approved', 'In Transit', 'Delivered', 'Denied']);
    const REQUISITION_PRIORITIES = new Set(['Routine', 'Tactical', 'Emergency']);
    const ENCOUNTER_TIERS = new Set(['Routine', 'Standard', 'Elite', 'Boss']);

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

    const toTrimmedString = (value, fallback = '', maxLen = 4000) => {
        if (value === null || value === undefined) return fallback;
        return String(value).slice(0, maxLen);
    };
    const toImageUrl = (value) => {
        const candidate = toTrimmedString(value, '', 4000).trim();
        if (!candidate) return '';

        if (/^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+$/i.test(candidate)) {
            return candidate;
        }

        try {
            const baseHref = global.location && typeof global.location.href === 'string'
                ? global.location.href
                : undefined;
            const parsed = baseHref ? new URL(candidate, baseHref) : new URL(candidate);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:' || parsed.protocol === 'blob:') {
                return parsed.href;
            }
        } catch (err) {
            return '';
        }

        return '';
    };

    const toBoolean = (value) => !!value;

    const buildEntityId = (prefix = 'entry', index = 0, bump = 0) => {
        const cleanPrefix = String(prefix || 'entry')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 12) || 'entry';
        const indexToken = Math.max(0, toNonNegativeInt(index, 0)).toString(36);
        const bumpToken = Math.max(0, toNonNegativeInt(bump, 0)).toString(36);
        return `${cleanPrefix}_${Date.now().toString(36)}_${indexToken}${Math.random().toString(36).slice(2, 7)}${bump ? '_' + bumpToken : ''}`;
    };

    const sanitizePatch = (raw, schema) => {
        const source = raw && typeof raw === 'object' ? raw : null;
        if (!source || !schema || typeof schema !== 'object') return null;

        const out = {};
        Object.keys(schema).forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(source, key)) return;
            const sanitizer = schema[key];
            if (typeof sanitizer !== 'function') return;
            out[key] = sanitizer(source[key]);
        });

        return Object.keys(out).length ? out : null;
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
        const source = rep && typeof rep === 'object' ? rep : {};
        const mergedKeys = [
            ...Object.keys(DEFAULT_STATE.campaign.rep),
            ...resolveDefaultGuildList(),
            ...Object.keys(source)
        ];
        const normalized = buildRepMapFromGuilds(mergedKeys);
        Object.keys(normalized).forEach((guild) => {
            const fallback = toNumber(DEFAULT_STATE.campaign.rep[guild], 0);
            normalized[guild] = toNumber(source[guild], fallback);
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
            name: typeof source.name === 'string' && source.name ? source.name : DEFAULT_BOARD_STATE.name,
            nodes: Array.isArray(source.nodes) ? source.nodes : [],
            connections: Array.isArray(source.connections) ? source.connections : []
        };
    };

    const sanitizeCaseId = (value, fallback = 'case') => {
        const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
        const cleaned = raw
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64);
        if (cleaned) return cleaned;
        return sanitizeCaseId(fallback, 'case_primary');
    };

    const sanitizeCaseName = (value, fallback = DEFAULT_CASE_NAME) => {
        const text = typeof value === 'string' ? value.trim() : '';
        return text || fallback;
    };

    const sanitizeEventList = (events) => (
        Array.isArray(events)
            ? events
                .filter((entry) => entry && typeof entry === 'object')
                .map((entry) => ({ ...entry }))
            : []
    );

    const sanitizeCases = (cases, campaign, board) => {
        const source = cases && typeof cases === 'object' ? cases : {};
        const baseCampaign = campaign && typeof campaign === 'object' ? campaign : {};
        const legacyCase = baseCampaign.case && typeof baseCampaign.case === 'object' ? baseCampaign.case : {};
        const legacyCaseTitle = sanitizeCaseName(legacyCase.title || '', DEFAULT_CASE_NAME);

        const legacySeed = {
            id: 'case_primary',
            name: legacyCaseTitle,
            board: sanitizeBoard(board),
            events: sanitizeEventList(baseCampaign.events)
        };

        const listRaw = Array.isArray(source.items) ? source.items
            : (Array.isArray(source.list) ? source.list : []);
        const startingList = listRaw.length ? listRaw : [legacySeed];

        const seen = new Set();
        const items = [];

        startingList.forEach((entry, idx) => {
            const row = entry && typeof entry === 'object' ? entry : {};
            const fallbackId = idx === 0 ? 'case_primary' : `case_${idx + 1}`;
            let id = sanitizeCaseId(row.id, fallbackId);
            if (seen.has(id)) {
                let suffix = 2;
                while (seen.has(`${id}_${suffix}`)) suffix += 1;
                id = `${id}_${suffix}`;
            }
            seen.add(id);

            const fallbackName = idx === 0 ? legacyCaseTitle : `Case ${idx + 1}`;
            const normalized = {
                id,
                name: sanitizeCaseName(row.name, fallbackName),
                board: sanitizeBoard(row.board),
                events: sanitizeEventList(row.events)
            };
            items.push(normalized);
        });

        if (!items.length) {
            items.push({
                id: 'case_primary',
                name: legacyCaseTitle,
                board: sanitizeBoard(null),
                events: []
            });
        }

        const activeRaw = sanitizeCaseId(source.activeCaseId, items[0].id);
        const activeCaseId = items.some((item) => item.id === activeRaw) ? activeRaw : items[0].id;
        return { activeCaseId, items };
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

    const sanitizeScopeUpdatedMap = (value) => {
        const source = value && typeof value === 'object' ? value : {};
        const out = Object.create(null);
        Object.keys(source).forEach((key) => {
            const scope = String(key || '').trim();
            if (!scope) return;
            if (!/^[a-z0-9_.-]+$/i.test(scope)) return;
            if (scope === '__proto__' || scope === 'prototype' || scope === 'constructor') return;
            out[scope] = toTimestamp(source[key], 0);
        });
        return out;
    };

    const sanitizeState = (state) => {
        const source = state && typeof state === 'object' ? state : {};
        const defaultMeta = deepClone(DEFAULT_STATE.meta);
        const sourceMeta = source.meta && typeof source.meta === 'object' ? source.meta : {};
        const version = toNonNegativeInt(sourceMeta.version, 1) || 1;
        const created = toTimestamp(sourceMeta.created, defaultMeta.created);
        const updated = toTimestamp(sourceMeta.updated, 0);
        const syncRevision = toNonNegativeInt(sourceMeta.syncRevision, 0);
        const scopeUpdated = sanitizeScopeUpdatedMap(sourceMeta.scopeUpdated);

        return {
            meta: { ...defaultMeta, ...sourceMeta, version, created, updated, syncRevision, scopeUpdated },
            campaign: sanitizeCampaign(source.campaign),
            board: sanitizeBoard(source.board),
            cases: sanitizeCases(source.cases, source.campaign, source.board),
            hq: sanitizeHQ(source.hq)
        };
    };

    const normalizeScopeToken = (scope) => {
        const raw = typeof scope === 'string' ? scope.trim().toLowerCase() : '';
        if (!raw) return SYNC_SCOPE_GLOBAL;
        if (raw === 'all') return SYNC_SCOPE_GLOBAL;
        if (!/^[a-z0-9_.-]+$/.test(raw)) return SYNC_SCOPE_GLOBAL;
        return raw;
    };

    const normalizeScopeList = (scopeOrList) => {
        const source = Array.isArray(scopeOrList) ? scopeOrList : [scopeOrList];
        const out = [];
        const seen = new Set();
        source.forEach((entry) => {
            const scope = normalizeScopeToken(entry);
            if (seen.has(scope)) return;
            seen.add(scope);
            out.push(scope);
        });
        if (!out.length) out.push(SYNC_SCOPE_GLOBAL);
        return out;
    };

    const scopesOverlap = (leftScope, rightScope) => {
        const left = normalizeScopeToken(leftScope);
        const right = normalizeScopeToken(rightScope);
        if (left === SYNC_SCOPE_GLOBAL || right === SYNC_SCOPE_GLOBAL) return true;
        if (left === right) return true;
        if (left === SYNC_SCOPE_CASES_META && right.startsWith('cases.')) return true;
        if (right === SYNC_SCOPE_CASES_META && left.startsWith('cases.')) return true;
        if (left.startsWith(`${right}.`)) return true;
        if (right.startsWith(`${left}.`)) return true;
        return false;
    };

    const buildCasesMetaSnapshot = (state) => {
        const sourceCases = state && state.cases && Array.isArray(state.cases.items) ? state.cases.items : [];
        return {
            activeCaseId: state && state.cases ? state.cases.activeCaseId : 'case_primary',
            items: sourceCases.map((entry) => ({
                id: entry && entry.id ? entry.id : '',
                name: entry && entry.name ? entry.name : DEFAULT_CASE_NAME
            }))
        };
    };

    const buildScopeSnapshot = (state) => {
        const clean = stripLocalOnlyFieldsForCloud(state);
        const map = new Map();
        map.set('campaign.rep', clean.campaign.rep);
        map.set('campaign.heat', clean.campaign.heat);
        map.set('campaign.players', clean.campaign.players);
        map.set('campaign.npcs', clean.campaign.npcs);
        map.set('campaign.locations', clean.campaign.locations);
        map.set('campaign.requisitions', clean.campaign.requisitions);
        map.set('campaign.encounters', clean.campaign.encounters);
        map.set('campaign.case', clean.campaign.case);
        map.set(SYNC_SCOPE_CASES_META, buildCasesMetaSnapshot(clean));
        map.set('hq', clean.hq);
        (clean.cases.items || []).forEach((entry) => {
            if (!entry || !entry.id) return;
            map.set(`cases.${entry.id}.board`, stripBoardNodeLocalFields(entry.board));
            map.set(`cases.${entry.id}.events`, sanitizeEventList(entry.events));
        });
        return map;
    };

    const getChangedScopes = (fromState, toState) => {
        const before = buildScopeSnapshot(fromState);
        const after = buildScopeSnapshot(toState);
        const keys = new Set([...before.keys(), ...after.keys()]);
        const changed = [];
        keys.forEach((key) => {
            const left = before.has(key) ? JSON.stringify(before.get(key)) : '';
            const right = after.has(key) ? JSON.stringify(after.get(key)) : '';
            if (left !== right) changed.push(key);
        });
        return changed;
    };

    const getOverlappingScopes = (localScopes, remoteScopes) => {
        const local = normalizeScopeList(localScopes);
        const remote = normalizeScopeList(remoteScopes);
        const overlap = [];
        local.forEach((scope) => {
            if (remote.some((remoteScope) => scopesOverlap(scope, remoteScope))) {
                overlap.push(scope);
            }
        });
        return overlap;
    };

    const getCaseById = (state, caseId) => {
        if (!state || !state.cases || !Array.isArray(state.cases.items)) return null;
        return state.cases.items.find((entry) => entry && entry.id === caseId) || null;
    };

    const ensureCaseForScope = (targetState, sourceState, caseId) => {
        let targetCase = getCaseById(targetState, caseId);
        if (targetCase) return targetCase;
        const sourceCase = getCaseById(sourceState, caseId);
        if (sourceCase) {
            targetCase = deepClone(sourceCase);
        } else {
            targetCase = {
                id: caseId,
                name: sanitizeCaseName(caseId, DEFAULT_CASE_NAME),
                board: sanitizeBoard(null),
                events: []
            };
        }
        targetState.cases.items.push(targetCase);
        return targetCase;
    };

    const applyCasesMetaFromSource = (targetState, sourceState) => {
        const sourceMeta = buildCasesMetaSnapshot(sourceState);
        const nextItems = [];
        sourceMeta.items.forEach((entry) => {
            if (!entry || !entry.id) return;
            const existingTarget = getCaseById(targetState, entry.id);
            if (existingTarget) {
                nextItems.push({
                    ...existingTarget,
                    name: sanitizeCaseName(entry.name, existingTarget.name || DEFAULT_CASE_NAME)
                });
                return;
            }
            const sourceCase = getCaseById(sourceState, entry.id);
            if (sourceCase) {
                nextItems.push(deepClone(sourceCase));
                return;
            }
            nextItems.push({
                id: entry.id,
                name: sanitizeCaseName(entry.name, DEFAULT_CASE_NAME),
                board: sanitizeBoard(null),
                events: []
            });
        });

        if (!nextItems.length) {
            nextItems.push({
                id: 'case_primary',
                name: DEFAULT_CASE_NAME,
                board: sanitizeBoard(null),
                events: []
            });
        }

        targetState.cases.items = nextItems;
        if (!targetState.cases.items.some((entry) => entry.id === sourceMeta.activeCaseId)) {
            targetState.cases.activeCaseId = targetState.cases.items[0].id;
            return;
        }
        targetState.cases.activeCaseId = sourceMeta.activeCaseId;
    };

    const applyScopeFromSource = (targetState, sourceState, scopeToken) => {
        const scope = normalizeScopeToken(scopeToken);
        if (scope === SYNC_SCOPE_GLOBAL) {
            const clean = sanitizeState(sourceState);
            targetState.meta = clean.meta;
            targetState.campaign = clean.campaign;
            targetState.cases = clean.cases;
            targetState.board = clean.board;
            targetState.hq = clean.hq;
            return;
        }

        if (scope === 'campaign') {
            targetState.campaign = deepClone(sourceState.campaign);
            return;
        }

        if (scope.startsWith('campaign.')) {
            const key = scope.slice('campaign.'.length);
            if (Object.prototype.hasOwnProperty.call(sourceState.campaign, key)) {
                targetState.campaign[key] = deepClone(sourceState.campaign[key]);
            }
            return;
        }

        if (scope === 'hq') {
            targetState.hq = deepClone(sourceState.hq);
            return;
        }

        if (scope === 'cases') {
            targetState.cases = deepClone(sourceState.cases);
            targetState.board = deepClone(sourceState.board);
            targetState.campaign.events = deepClone(sourceState.campaign.events);
            return;
        }

        if (scope === SYNC_SCOPE_CASES_META) {
            applyCasesMetaFromSource(targetState, sourceState);
            return;
        }

        const caseFieldMatch = scope.match(/^cases\.([a-z0-9_-]+)\.(board|events|name)$/);
        if (caseFieldMatch) {
            const caseId = caseFieldMatch[1];
            const field = caseFieldMatch[2];
            const targetCase = ensureCaseForScope(targetState, sourceState, caseId);
            const sourceCase = getCaseById(sourceState, caseId) || {
                id: caseId,
                name: targetCase.name || DEFAULT_CASE_NAME,
                board: sanitizeBoard(null),
                events: []
            };
            if (field === 'board') targetCase.board = deepClone(sourceCase.board);
            if (field === 'events') targetCase.events = deepClone(sourceCase.events);
            if (field === 'name') targetCase.name = sanitizeCaseName(sourceCase.name, targetCase.name || DEFAULT_CASE_NAME);
            return;
        }

        const caseWholeMatch = scope.match(/^cases\.([a-z0-9_-]+)$/);
        if (caseWholeMatch) {
            const caseId = caseWholeMatch[1];
            const sourceCase = getCaseById(sourceState, caseId);
            if (!sourceCase) return;
            const targetCase = ensureCaseForScope(targetState, sourceState, caseId);
            targetCase.name = sanitizeCaseName(sourceCase.name, targetCase.name || DEFAULT_CASE_NAME);
            targetCase.board = deepClone(sourceCase.board);
            targetCase.events = deepClone(sourceCase.events);
            return;
        }

        if (scope === 'board') {
            targetState.board = deepClone(sourceState.board);
        }
    };

    const mergeStateByScopes = (baseState, sourceState, scopes) => {
        const base = sanitizeState(baseState);
        const source = sanitizeState(sourceState);
        const scopeList = normalizeScopeList(scopes);
        if (scopeList.includes(SYNC_SCOPE_GLOBAL)) return source;

        scopeList.forEach((scope) => {
            applyScopeFromSource(base, source, scope);
        });

        const clean = sanitizeState(base);
        const active = clean.cases.items.find((entry) => entry && entry.id === clean.cases.activeCaseId) || clean.cases.items[0];
        if (active) {
            clean.board = active.board;
            clean.campaign.events = active.events;
        }
        return clean;
    };

    const isFiniteNum = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed);
    };

    const buildLocalOnlyBoardLayoutMap = (state) => {
        const perCaseLayouts = new Map();
        const sourceCases = state && state.cases && Array.isArray(state.cases.items) ? state.cases.items : [];

        sourceCases.forEach((caseEntry) => {
            if (!caseEntry || !caseEntry.id || !caseEntry.board || !Array.isArray(caseEntry.board.nodes)) return;
            const layout = new Map();
            caseEntry.board.nodes.forEach((node) => {
                if (!node || !node.id) return;
                if (!isFiniteNum(node.x) || !isFiniteNum(node.y)) return;
                layout.set(node.id, { x: Number(node.x), y: Number(node.y) });
            });
            perCaseLayouts.set(caseEntry.id, layout);
        });

        if (!perCaseLayouts.size) {
            const fallback = new Map();
            const source = state && state.board && Array.isArray(state.board.nodes) ? state.board.nodes : [];
            source.forEach((node) => {
                if (!node || !node.id) return;
                if (!isFiniteNum(node.x) || !isFiniteNum(node.y)) return;
                fallback.set(node.id, { x: Number(node.x), y: Number(node.y) });
            });
            perCaseLayouts.set('case_primary', fallback);
        }

        return perCaseLayouts;
    };

    const applyBoardLayout = (boardState, layoutMap) => {
        const board = sanitizeBoard(boardState);
        const layout = layoutMap instanceof Map ? layoutMap : new Map();

        board.nodes = board.nodes.map((node, idx) => {
            const base = node && typeof node === 'object' ? { ...node } : {};
            const local = base.id ? layout.get(base.id) : null;

            if (local) {
                base.x = local.x;
                base.y = local.y;
                return base;
            }

            if (!isFiniteNum(base.x)) base.x = 120 + (idx % 6) * 240;
            else base.x = Number(base.x);
            if (!isFiniteNum(base.y)) base.y = 120 + Math.floor(idx / 6) * 150;
            else base.y = Number(base.y);
            return base;
        });

        return board;
    };

    const stripBoardNodeLocalFields = (boardState) => {
        const board = sanitizeBoard(boardState);
        board.nodes = board.nodes.map((node) => {
            if (!node || typeof node !== 'object') return node;
            const copy = { ...node };
            delete copy.x;
            delete copy.y;
            return copy;
        });
        return board;
    };

    const mergeRemoteBoardWithLocalLayout = (remoteState, localState) => {
        const merged = sanitizeState(remoteState);
        const localLayouts = buildLocalOnlyBoardLayoutMap(localState);

        if (merged.cases && Array.isArray(merged.cases.items)) {
            merged.cases.items = merged.cases.items.map((caseEntry) => {
                const localLayout = localLayouts.get(caseEntry.id) || new Map();
                return {
                    ...caseEntry,
                    board: applyBoardLayout(caseEntry.board, localLayout)
                };
            });

            const activeCase = merged.cases.items.find((item) => item.id === merged.cases.activeCaseId) || merged.cases.items[0];
            if (activeCase) merged.board = activeCase.board;
            return merged;
        }

        const fallbackLayout = localLayouts.get('case_primary') || new Map();
        merged.board = applyBoardLayout(merged.board, fallbackLayout);
        return merged;
    };

    const stripLocalOnlyFieldsForCloud = (state) => {
        const cloud = sanitizeState(state);
        if (cloud.cases && Array.isArray(cloud.cases.items)) {
            cloud.cases.items = cloud.cases.items.map((caseEntry) => ({
                ...caseEntry,
                board: stripBoardNodeLocalFields(caseEntry.board)
            }));
            const activeCase = cloud.cases.items.find((item) => item.id === cloud.cases.activeCaseId) || cloud.cases.items[0];
            if (activeCase) cloud.board = activeCase.board;
            return cloud;
        }

        cloud.board = stripBoardNodeLocalFields(cloud.board);
        return cloud;
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
            syncDelayMs: Math.max(250, toNonNegativeInt(source.syncDelayMs, DEFAULT_SYNC_CONFIG.syncDelayMs) || DEFAULT_SYNC_CONFIG.syncDelayMs),
            reconcileIntervalMs: Math.max(5000, toNonNegativeInt(source.reconcileIntervalMs, DEFAULT_SYNC_CONFIG.reconcileIntervalMs) || DEFAULT_SYNC_CONFIG.reconcileIntervalMs),
            presenceHeartbeatMs: Math.max(3000, toNonNegativeInt(source.presenceHeartbeatMs, DEFAULT_SYNC_CONFIG.presenceHeartbeatMs) || DEFAULT_SYNC_CONFIG.presenceHeartbeatMs),
            lockTtlMs: Math.max(5000, toNonNegativeInt(source.lockTtlMs, DEFAULT_SYNC_CONFIG.lockTtlMs) || DEFAULT_SYNC_CONFIG.lockTtlMs)
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
                reconcileTimer: null,
                presenceTimer: null,
                presenceTrackingInFlight: false,
                pushInFlight: false,
                pushQueued: false,
                lastRemoteSeenAt: 0,
                lastPushAt: 0,
                lastPullAt: 0,
                userId: '',
                supabaseLoadPromise: null,
                lastCloudStateSig: '',
                localDirtyScopes: new Set(),
                lastSyncedState: sanitizeState(this.state),
                lastKnownRemoteRevision: 0,
                pendingConflict: null,
                localSoftLocks: new Map(),
                remoteSoftLocks: new Map(),
                remotePeers: new Map()
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
                localRevision: 0,
                remoteRevision: 0,
                revisionMode: 'optimistic',
                dirtyScopes: 0,
                presencePeers: 0,
                activeRemoteLocks: 0,
                pendingConflict: false,
                conflictScopes: [],
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

        ensureCaseStateIntegrity() {
            if (!this.state || typeof this.state !== 'object') {
                this.state = sanitizeState(null);
            }
            if (!this.state.campaign || typeof this.state.campaign !== 'object') {
                this.state.campaign = sanitizeCampaign(null);
            }

            const cases = this.state.cases;
            if (!cases || !Array.isArray(cases.items) || !cases.items.length) {
                this.state.cases = sanitizeCases(this.state.cases, this.state.campaign, this.state.board);
            }

            if (!this.state.cases.items.some((entry) => entry && entry.id === this.state.cases.activeCaseId)) {
                this.state.cases.activeCaseId = this.state.cases.items[0].id;
            }

            return this.state.cases;
        }

        getCaseEntry(caseId = null, options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            const createIfMissing = !!opts.createIfMissing;
            const strict = !!opts.strict;
            const cases = this.ensureCaseStateIntegrity();
            const desiredId = sanitizeCaseId(caseId || cases.activeCaseId, cases.activeCaseId);
            let entry = cases.items.find((item) => item && item.id === desiredId);

            if (!entry && createIfMissing) {
                const prettyName = sanitizeCaseName(String(desiredId || '').replace(/[-_]+/g, ' '), DEFAULT_CASE_NAME);
                entry = {
                    id: desiredId,
                    name: prettyName,
                    board: sanitizeBoard({ name: prettyName }),
                    events: []
                };
                cases.items.push(entry);
            }

            if (!entry && strict) return null;
            if (!entry) entry = cases.items.find((item) => item && item.id === cases.activeCaseId) || cases.items[0];
            if (!entry.board || typeof entry.board !== 'object') entry.board = sanitizeBoard(null);
            if (!Array.isArray(entry.events)) entry.events = [];
            return entry || null;
        }

        syncActiveCaseLegacyState() {
            const active = this.getCaseEntry();
            if (!active) return;
            // Backward compatibility: legacy state paths mirror current active case.
            this.state.board = active.board;
            this.state.campaign.events = active.events;
        }

        getCases() {
            const cases = this.ensureCaseStateIntegrity();
            return cases.items.map((entry) => ({
                id: entry.id,
                name: entry.name
            }));
        }

        getActiveCaseId() {
            const cases = this.ensureCaseStateIntegrity();
            return cases.activeCaseId;
        }

        getActiveCase() {
            const active = this.getCaseEntry();
            return active ? deepClone({ id: active.id, name: active.name }) : null;
        }

        createCase(name = '') {
            const cases = this.ensureCaseStateIntegrity();
            const cleanName = sanitizeCaseName(name, 'New Case');
            const baseId = sanitizeCaseId(cleanName, 'case');
            let id = baseId;
            let suffix = 2;
            while (cases.items.some((entry) => entry && entry.id === id)) {
                id = `${baseId}_${suffix}`;
                suffix += 1;
            }

            const entry = {
                id,
                name: cleanName,
                board: sanitizeBoard({ name: cleanName }),
                events: []
            };
            cases.items.push(entry);
            cases.activeCaseId = id;
            this.syncActiveCaseLegacyState();
            this.save({ scope: [SYNC_SCOPE_CASES_META, `cases.${id}.board`, `cases.${id}.events`] });
            return id;
        }

        renameCase(caseId, nextName) {
            const target = this.getCaseEntry(caseId, { strict: true });
            if (!target) return false;
            const prevName = target.name;
            const cleanName = sanitizeCaseName(nextName, prevName);
            target.name = cleanName;
            if (!target.board || typeof target.board !== 'object') {
                target.board = sanitizeBoard({ name: cleanName });
            } else {
                const boardName = typeof target.board.name === 'string' ? target.board.name.trim() : '';
                if (!boardName || boardName === prevName || boardName === DEFAULT_BOARD_STATE.name) {
                    target.board.name = cleanName;
                }
            }
            this.syncActiveCaseLegacyState();
            this.save({ scope: SYNC_SCOPE_CASES_META });
            return true;
        }

        deleteCase(caseId) {
            const cases = this.ensureCaseStateIntegrity();
            if (cases.items.length <= 1) return false;
            const targetId = sanitizeCaseId(caseId, cases.activeCaseId);
            const idx = cases.items.findIndex((entry) => entry && entry.id === targetId);
            if (idx < 0) return false;
            cases.items.splice(idx, 1);
            if (!cases.items.some((entry) => entry.id === cases.activeCaseId)) {
                cases.activeCaseId = cases.items[Math.max(0, idx - 1)].id;
            }
            this.syncActiveCaseLegacyState();
            this.save({ scope: SYNC_SCOPE_CASES_META });
            return true;
        }

        setActiveCase(caseId) {
            const cases = this.ensureCaseStateIntegrity();
            const targetId = sanitizeCaseId(caseId, cases.activeCaseId);
            const exists = cases.items.some((entry) => entry && entry.id === targetId);
            if (!exists) return false;
            if (cases.activeCaseId === targetId) return true;
            cases.activeCaseId = targetId;
            this.syncActiveCaseLegacyState();
            this.save({ scope: SYNC_SCOPE_CASES_META });
            return true;
        }

        load() {
            try {
                const raw = localStorage.getItem(STORE_KEY);
                if (raw) {
                    const loaded = JSON.parse(raw);
                    this.state = sanitizeState(loaded);
                    logInfo("RTF_STORE: Loaded unified data.");
                } else {
                    logInfo("RTF_STORE: No unified data found. Attempting migration...");
                    this.migrate();
                }

                this.state = sanitizeState(this.state);
                this.ensureCampaignEntityIds(false);
                this.syncActiveCaseLegacyState();
                if (this.ingestPreloadedData()) this.save({ scope: 'campaign' });
                this.sync.lastSyncedState = sanitizeState(this.state);
                this.sync.lastKnownRemoteRevision = toNonNegativeInt(this.state.meta && this.state.meta.syncRevision, 0);
            } catch (e) {
                console.error("RTF_STORE: Load failed", e);
                this.state = sanitizeState(null);
                this.syncActiveCaseLegacyState();
                this.sync.lastSyncedState = sanitizeState(this.state);
                this.sync.lastKnownRemoteRevision = 0;
            }
        }

        ingestPreloadedData() {
            let changed = false;

            if (window.PRELOADED_NPCS && Array.isArray(window.PRELOADED_NPCS)) {
                const normalizeNPCField = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
                const buildNPCSignature = (npc) => [
                    normalizeNPCField(npc && npc.name),
                    normalizeNPCField(npc && npc.guild),
                    normalizeNPCField(npc && npc.wants),
                    normalizeNPCField(npc && npc.leverage),
                    normalizeNPCField(npc && npc.notes)
                ].join('|');
                const preloadedSignatures = new Set(window.PRELOADED_NPCS.map(buildNPCSignature));

                // Backfill source markers for existing exact preloaded records.
                this.state.campaign.npcs.forEach((npc) => {
                    if (!npc || typeof npc !== 'object') return;
                    if (npc.__rtfSource) return;
                    if (preloadedSignatures.has(buildNPCSignature(npc))) {
                        npc.__rtfSource = 'preloaded';
                        changed = true;
                    }
                });

                const existingNames = new Set(this.state.campaign.npcs.map(n => n.name));
                let count = 0;
                window.PRELOADED_NPCS.forEach(n => {
                    if (!existingNames.has(n.name)) {
                        this.state.campaign.npcs.push({ ...n, __rtfSource: 'preloaded' });
                        existingNames.add(n.name);
                        count++;
                    }
                });
                if (count > 0) {
                    logInfo(`RTF_STORE: Seeded ${count} NPCs.`);
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
                    logInfo(`RTF_STORE: Seeded ${count} Locations.`);
                    changed = true;
                }
            }

            return changed;
        }

        save(options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            const skipCloud = !!opts.skipCloud;
            const skipEvent = !!opts.skipEvent;
            const scopes = normalizeScopeList(opts.scope || SYNC_SCOPE_GLOBAL);

            try {
                this.ensureCampaignEntityIds(false);
                this.syncActiveCaseLegacyState();
                const now = Date.now();
                this.state.meta.updated = now;
                this.markLocalDirtyScopes(scopes, now);
                this.touchSoftLockScopes(scopes);
                localStorage.setItem(STORE_KEY, JSON.stringify(this.state));

                if (!skipCloud && !this.isApplyingRemote) this.scheduleCloudPush('local-save');
                if (!skipEvent) this.broadcastStoreUpdate('local', { scopes });
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
                    if (hubData && typeof hubData === 'object') {
                        if (Object.prototype.hasOwnProperty.call(hubData, 'rep')) this.state.campaign.rep = hubData.rep;
                        if (Object.prototype.hasOwnProperty.call(hubData, 'heat')) this.state.campaign.heat = hubData.heat;
                        if (Object.prototype.hasOwnProperty.call(hubData, 'players')) this.state.campaign.players = hubData.players;
                        if (Object.prototype.hasOwnProperty.call(hubData, 'case')) this.state.campaign.case = hubData.case;
                        migrated = true;
                        logInfo("RTF_STORE: Migrated Hub data.");
                    }
                } catch (e) {
                    console.warn("Migration error (Hub):", e);
                }
            }

            const boardRaw = localStorage.getItem(LEGACY_BOARD_KEY);
            if (boardRaw) {
                try {
                    const boardData = JSON.parse(boardRaw);
                    if (boardData && typeof boardData === 'object') {
                        if (Object.prototype.hasOwnProperty.call(boardData, 'name')) this.state.board.name = boardData.name;
                        if (Object.prototype.hasOwnProperty.call(boardData, 'nodes')) this.state.board.nodes = boardData.nodes;
                        if (Object.prototype.hasOwnProperty.call(boardData, 'connections')) this.state.board.connections = boardData.connections;
                        migrated = true;
                        logInfo("RTF_STORE: Migrated Board data.");
                    }
                } catch (e) {
                    console.warn("Migration error (Board):", e);
                }
            }

            if (migrated) {
                this.state.cases = sanitizeCases(null, this.state.campaign, this.state.board);
                this.syncActiveCaseLegacyState();
                this.save({ scope: SYNC_SCOPE_GLOBAL });
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
                    const target = e && e.target ? e.target : null;
                    const file = target && target.files && target.files[0] ? target.files[0] : null;
                    if (!file) {
                        resolve(false);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = event => {
                        try {
                            const payload = event && event.target ? event.target.result : '';
                            if (typeof payload !== 'string') {
                                alert("Invalid JSON file");
                                resolve(false);
                                return;
                            }
                            const loaded = JSON.parse(payload);
                            if (!loaded || typeof loaded !== 'object') {
                                alert("Invalid format: Expected JSON object.");
                                resolve(false);
                                return;
                            }

                            const hasKnownRoot = ['meta', 'campaign', 'board', 'cases', 'hq'].some(key => Object.prototype.hasOwnProperty.call(loaded, key));
                            if (!hasKnownRoot) {
                                alert("Invalid format: Missing campaign/case/board data.");
                                resolve(false);
                                return;
                            }

                            this.state = sanitizeState(loaded);
                            this.ensureCampaignEntityIds(false);
                            this.save({ scope: SYNC_SCOPE_GLOBAL });
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
            if (this.syncStatus.connected) this.startReconcileLoop();

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
            this.sync.pendingConflict = null;
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
            const derived = {
                localRevision: toNonNegativeInt(this.state && this.state.meta ? this.state.meta.syncRevision : 0, 0),
                remoteRevision: toNonNegativeInt(this.sync.lastKnownRemoteRevision, 0),
                dirtyScopes: this.sync.localDirtyScopes ? this.sync.localDirtyScopes.size : 0,
                presencePeers: this.sync.remotePeers ? this.sync.remotePeers.size : 0,
                activeRemoteLocks: this.sync.remoteSoftLocks ? this.sync.remoteSoftLocks.size : 0,
                pendingConflict: !!this.sync.pendingConflict,
                conflictScopes: this.sync.pendingConflict && Array.isArray(this.sync.pendingConflict.overlappingScopes)
                    ? this.sync.pendingConflict.overlappingScopes.slice()
                    : []
            };
            this.syncStatus = {
                ...this.syncStatus,
                ...derived,
                ...(patch || {}),
                updatedAt: Date.now()
            };
            this.emitSyncStatus();
        }

        getDirtyScopesSnapshot(scopes = null) {
            if (!this.sync.localDirtyScopes) this.sync.localDirtyScopes = new Set();
            if (scopes === null || scopes === undefined) {
                const current = Array.from(this.sync.localDirtyScopes.values());
                return current.length ? current : [SYNC_SCOPE_GLOBAL];
            }
            return normalizeScopeList(scopes);
        }

        markLocalDirtyScopes(scopes, timestamp = Date.now()) {
            if (!this.sync.localDirtyScopes) this.sync.localDirtyScopes = new Set();
            if (!this.state.meta || typeof this.state.meta !== 'object') {
                this.state.meta = deepClone(DEFAULT_STATE.meta);
            }
            if (!this.state.meta.scopeUpdated || typeof this.state.meta.scopeUpdated !== 'object') {
                this.state.meta.scopeUpdated = {};
            }
            const list = normalizeScopeList(scopes);
            list.forEach((scope) => {
                this.sync.localDirtyScopes.add(scope);
                this.state.meta.scopeUpdated[scope] = timestamp;
            });
            return list;
        }

        clearLocalDirtyScopes(scopes = null) {
            if (!this.sync.localDirtyScopes) this.sync.localDirtyScopes = new Set();
            if (scopes === null || scopes === undefined) {
                this.sync.localDirtyScopes.clear();
                return;
            }
            normalizeScopeList(scopes).forEach((scope) => {
                this.sync.localDirtyScopes.delete(scope);
            });
        }

        clearExpiredSoftLocks(now = Date.now()) {
            if (!this.sync.localSoftLocks) this.sync.localSoftLocks = new Map();
            const expired = [];
            this.sync.localSoftLocks.forEach((expiresAt, scope) => {
                if (!Number.isFinite(expiresAt) || expiresAt <= now) expired.push(scope);
            });
            expired.forEach((scope) => this.sync.localSoftLocks.delete(scope));
        }

        serializeLocalSoftLocks() {
            this.clearExpiredSoftLocks();
            const out = {};
            this.sync.localSoftLocks.forEach((expiresAt, scope) => {
                if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
                out[scope] = expiresAt;
            });
            return out;
        }

        touchSoftLockScopes(scopes, ttlMs = null) {
            if (!this.syncStatus.connected) return;
            if (!this.sync.localSoftLocks) this.sync.localSoftLocks = new Map();
            const ttl = Math.max(5000, toNonNegativeInt(ttlMs, this.sync.config.lockTtlMs) || this.sync.config.lockTtlMs);
            const expiresAt = Date.now() + ttl;
            normalizeScopeList(scopes).forEach((scope) => {
                if (!scope || scope === SYNC_SCOPE_GLOBAL) return;
                this.sync.localSoftLocks.set(scope, expiresAt);
            });
            this.clearExpiredSoftLocks();
            this.refreshPresenceTracking().catch(() => { });
        }

        getRemoteLockConflicts(scopes) {
            if (!this.sync.remoteSoftLocks || !this.sync.remoteSoftLocks.size) return [];
            const checkScopes = normalizeScopeList(scopes);
            const now = Date.now();
            const conflicts = [];
            this.sync.remoteSoftLocks.forEach((lock, lockScope) => {
                if (!lock || !lock.scope || !Number.isFinite(lock.expiresAt)) return;
                if (lock.expiresAt <= now) return;
                if (checkScopes.some((scope) => scopesOverlap(scope, lockScope))) {
                    conflicts.push({
                        scope: lock.scope,
                        byInstance: lock.instanceId,
                        byProfile: lock.profileName || '',
                        expiresAt: lock.expiresAt
                    });
                }
            });
            return conflicts;
        }

        handlePresenceState(presenceState) {
            const raw = presenceState && typeof presenceState === 'object' ? presenceState : {};
            const peers = new Map();
            const locks = new Map();
            const now = Date.now();

            Object.keys(raw).forEach((presenceKey) => {
                const entries = Array.isArray(raw[presenceKey]) ? raw[presenceKey] : [];
                entries.forEach((entry) => {
                    if (!entry || typeof entry !== 'object') return;
                    const instanceId = typeof entry.instanceId === 'string' ? entry.instanceId : '';
                    if (!instanceId || instanceId === this.sync.instanceId) return;
                    peers.set(instanceId, {
                        instanceId,
                        userId: typeof entry.userId === 'string' ? entry.userId : '',
                        profileName: typeof entry.profileName === 'string' ? entry.profileName : '',
                        seenAt: now
                    });

                    const lockMap = entry.locks && typeof entry.locks === 'object' ? entry.locks : {};
                    Object.keys(lockMap).forEach((scopeToken) => {
                        const scope = normalizeScopeToken(scopeToken);
                        if (!scope || scope === SYNC_SCOPE_GLOBAL) return;
                        const expiresAt = toTimestamp(lockMap[scopeToken], 0);
                        if (!expiresAt || expiresAt <= now) return;
                        const existing = locks.get(scope);
                        if (!existing || expiresAt > existing.expiresAt) {
                            locks.set(scope, {
                                scope,
                                instanceId,
                                profileName: typeof entry.profileName === 'string' ? entry.profileName : '',
                                expiresAt
                            });
                        }
                    });
                });
            });

            this.sync.remotePeers = peers;
            this.sync.remoteSoftLocks = locks;
            this.updateSyncStatus({});
        }

        async refreshPresenceTracking() {
            if (!this.sync.channel || typeof this.sync.channel.track !== 'function') return;
            if (this.sync.presenceTrackingInFlight) return;
            this.sync.presenceTrackingInFlight = true;
            try {
                const payload = {
                    instanceId: this.sync.instanceId,
                    userId: this.sync.userId || '',
                    profileName: this.sync.config.profileName || '',
                    ts: Date.now(),
                    locks: this.serializeLocalSoftLocks()
                };
                await this.sync.channel.track(payload);
            } catch (err) {
                console.warn('RTF_STORE: Presence track failed', err);
            } finally {
                this.sync.presenceTrackingInFlight = false;
            }
        }

        startReconcileLoop() {
            this.stopReconcileLoop();
            if (!this.syncStatus.connected) return;
            const reconcileEvery = Math.max(5000, toNonNegativeInt(this.sync.config.reconcileIntervalMs, DEFAULT_SYNC_CONFIG.reconcileIntervalMs));
            const presenceEvery = Math.max(3000, toNonNegativeInt(this.sync.config.presenceHeartbeatMs, DEFAULT_SYNC_CONFIG.presenceHeartbeatMs));

            this.sync.reconcileTimer = setInterval(() => {
                if (!this.syncStatus.connected) return;
                this.pullFromCloud({ silent: true, force: false }).catch(() => { });
            }, reconcileEvery);

            this.sync.presenceTimer = setInterval(() => {
                this.clearExpiredSoftLocks();
                this.refreshPresenceTracking().catch(() => { });
            }, presenceEvery);
        }

        stopReconcileLoop() {
            if (this.sync.reconcileTimer) {
                clearInterval(this.sync.reconcileTimer);
                this.sync.reconcileTimer = null;
            }
            if (this.sync.presenceTimer) {
                clearInterval(this.sync.presenceTimer);
                this.sync.presenceTimer = null;
            }
        }

        async fetchCloudRow(options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            const silent = !!opts.silent;

            if (!this.sync.client || !this.syncStatus.connected) {
                return { ok: false, reason: 'not-connected' };
            }

            const config = this.sync.config;
            const result = await this.sync.client
                .from(config.tableName)
                .select('state,updated_at,updated_by,updated_by_name')
                .eq('campaign_id', config.campaignId)
                .maybeSingle();

            if (result.error) {
                const code = result.error.code || '';
                if (code === 'PGRST116') {
                    return { ok: true, reason: 'empty', row: null };
                }
                const message = result.error.message || 'Cloud read failed.';
                if (!silent) {
                    this.updateSyncStatus({
                        mode: 'error',
                        message: 'Cloud read failed.',
                        lastError: message
                    });
                }
                return { ok: false, reason: 'error', error: message };
            }

            const data = result.data;
            if (!data || !data.state) {
                return { ok: true, reason: 'empty', row: null };
            }

            const cleanState = sanitizeState(data.state);
            const revision = toNonNegativeInt(cleanState.meta && cleanState.meta.syncRevision, 0);
            return {
                ok: true,
                reason: 'row',
                row: {
                    state: cleanState,
                    revision,
                    updatedAt: toTimestamp(data.updated_at, 0),
                    updatedAtRaw: typeof data.updated_at === 'string' ? data.updated_at : '',
                    updatedBy: data.updated_by || '',
                    updatedByName: data.updated_by_name || ''
                }
            };
        }

        buildConflictRecord(remoteRow, localScopes) {
            const remoteState = sanitizeState(remoteRow && remoteRow.state ? remoteRow.state : null);
            const localState = sanitizeState(this.state);
            const baseline = sanitizeState(this.sync.lastSyncedState || remoteState);
            const dirtyScopes = this.getDirtyScopesSnapshot(localScopes);
            const remoteChangedScopes = getChangedScopes(baseline, remoteState);
            const overlappingScopes = getOverlappingScopes(dirtyScopes, remoteChangedScopes);
            const mergedState = mergeStateByScopes(remoteState, localState, dirtyScopes);
            return {
                id: `conf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                createdAt: Date.now(),
                dirtyScopes,
                remoteChangedScopes,
                overlappingScopes,
                remoteRevision: toNonNegativeInt(remoteRow && remoteRow.revision, 0),
                localRevision: toNonNegativeInt(localState.meta && localState.meta.syncRevision, 0),
                remoteUpdatedAt: toTimestamp(remoteRow && remoteRow.updatedAt, 0),
                remoteUpdatedAtRaw: remoteRow && remoteRow.updatedAtRaw ? remoteRow.updatedAtRaw : '',
                remoteUpdatedBy: remoteRow && remoteRow.updatedBy ? remoteRow.updatedBy : '',
                remoteUpdatedByName: remoteRow && remoteRow.updatedByName ? remoteRow.updatedByName : '',
                mergedState,
                remoteState
            };
        }

        adoptMergedConflictState(conflict, reason = 'auto-merge') {
            if (!conflict || !conflict.mergedState) return false;
            const dirtyScopes = conflict.dirtyScopes && conflict.dirtyScopes.length ? conflict.dirtyScopes : [SYNC_SCOPE_GLOBAL];
            this.state = sanitizeState(conflict.mergedState);
            this.syncActiveCaseLegacyState();
            this.ensureCampaignEntityIds(false);
            this.state.meta.updated = Date.now();
            this.state.meta.syncRevision = toNonNegativeInt(conflict.remoteRevision, this.state.meta.syncRevision);
            this.markLocalDirtyScopes(dirtyScopes, Date.now());
            this.sync.lastKnownRemoteRevision = Math.max(this.sync.lastKnownRemoteRevision, toNonNegativeInt(conflict.remoteRevision, 0));
            this.sync.lastSyncedState = sanitizeState(conflict.remoteState);
            try {
                localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
            } catch (writeErr) {
                console.warn('RTF_STORE: Failed writing merged conflict state', writeErr);
            }
            this.broadcastStoreUpdate('local', { source: reason, scopes: dirtyScopes });
            this.scheduleCloudPush(reason);
            this.updateSyncStatus({
                mode: 'ready',
                message: 'Merged non-overlapping remote changes with local edits.'
            });
            return true;
        }

        getPendingConflict() {
            const conflict = this.sync.pendingConflict;
            if (!conflict) return null;
            return {
                id: conflict.id,
                createdAt: conflict.createdAt,
                dirtyScopes: deepClone(conflict.dirtyScopes),
                remoteChangedScopes: deepClone(conflict.remoteChangedScopes),
                overlappingScopes: deepClone(conflict.overlappingScopes),
                remoteRevision: conflict.remoteRevision,
                localRevision: conflict.localRevision,
                remoteUpdatedAt: conflict.remoteUpdatedAt,
                remoteUpdatedBy: conflict.remoteUpdatedBy,
                remoteUpdatedByName: conflict.remoteUpdatedByName
            };
        }

        setPendingConflict(conflict) {
            if (!conflict) return null;
            this.sync.pendingConflict = conflict;
            const summary = this.getPendingConflict();
            this.updateSyncStatus({
                mode: 'conflict',
                message: 'Remote changed while you were editing. Resolve the conflict before pushing.',
                pendingPush: false
            });
            if (summary && typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
                global.dispatchEvent(new CustomEvent(SYNC_CONFLICT_EVENT, { detail: summary }));
            }
            return summary;
        }

        clearPendingConflict(options = {}) {
            const opts = options && typeof options === 'object' ? options : {};
            this.sync.pendingConflict = null;
            if (opts.keepStatus) return;
            this.updateSyncStatus({
                mode: this.syncStatus.connected ? 'ready' : this.syncStatus.mode,
                message: opts.message || this.syncStatus.message
            });
        }

        async resolvePendingConflict(action = 'accept-remote') {
            const conflict = this.sync.pendingConflict;
            if (!conflict) return { ok: false, reason: 'no-conflict' };

            if (action === 'accept-remote') {
                const applied = this.applyRemoteState(conflict.remoteState, {
                    source: 'conflict-accept',
                    updatedAt: conflict.remoteUpdatedAt,
                    updatedBy: conflict.remoteUpdatedBy,
                    revision: conflict.remoteRevision,
                    force: true
                });
                this.clearLocalDirtyScopes();
                this.clearPendingConflict({ message: 'Accepted remote state.' });
                return { ok: true, action, applied };
            }

            if (action === 'keep-local') {
                const dirtyScopes = conflict.dirtyScopes && conflict.dirtyScopes.length ? conflict.dirtyScopes : [SYNC_SCOPE_GLOBAL];
                this.state = sanitizeState(conflict.mergedState);
                this.syncActiveCaseLegacyState();
                this.ensureCampaignEntityIds(false);
                this.markLocalDirtyScopes(dirtyScopes, Date.now());
                this.save({ skipCloud: true, scope: dirtyScopes });
                this.sync.lastKnownRemoteRevision = toNonNegativeInt(conflict.remoteRevision, this.sync.lastKnownRemoteRevision);
                this.sync.pendingConflict = null;
                const pushed = await this.pushToCloud({
                    reason: 'resolve-conflict',
                    silent: false,
                    force: true,
                    baseRevision: this.sync.lastKnownRemoteRevision,
                    scopes: dirtyScopes,
                    attempt: 0
                });
                if (pushed.ok) {
                    this.clearPendingConflict({ message: 'Merged local changes and pushed to cloud.' });
                    return { ok: true, action, pushed: true };
                }
                if (pushed.reason !== 'conflict') {
                    this.setPendingConflict(conflict);
                }
                return pushed;
            }

            return { ok: false, reason: 'unknown-action' };
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
                this.clearPendingConflict({ keepStatus: true });
                this.startReconcileLoop();

                this.updateSyncStatus({
                    mode: 'ready',
                    connected: true,
                    userId: this.sync.userId,
                    revisionMode: 'optimistic',
                    message: 'Connected to cloud sync.'
                });

                const isInitialPull = !this.sync.lastPullAt;
                const pull = await this.pullFromCloud({ force: isInitialPull, silent: true });
                if (!pull.ok && pull.reason !== 'conflict') {
                    throw new Error(pull.error || 'Initial cloud pull failed.');
                }
                if (!pull.ok && pull.reason === 'conflict') {
                    this.updateSyncStatus({
                        mode: 'conflict',
                        message: 'Connected. Conflict detected with local edits.'
                    });
                }
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
            this.stopReconcileLoop();

            if (this.sync.channel && this.sync.client) {
                try {
                    if (typeof this.sync.channel.untrack === 'function') {
                        try { await this.sync.channel.untrack(); } catch (err) { }
                    }
                    await this.sync.client.removeChannel(this.sync.channel);
                } catch (err) {
                    console.warn('RTF_STORE: Failed removing sync channel', err);
                }
            }
            this.sync.channel = null;
            this.sync.pushInFlight = false;
            this.sync.pushQueued = false;
            this.sync.remotePeers = new Map();
            this.sync.remoteSoftLocks = new Map();
            this.sync.localSoftLocks = new Map();
            this.sync.pendingConflict = null;

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

            channel.on('presence', { event: 'sync' }, () => {
                const state = typeof channel.presenceState === 'function' ? channel.presenceState() : {};
                this.handlePresenceState(state);
            });
            channel.on('presence', { event: 'join' }, () => {
                const state = typeof channel.presenceState === 'function' ? channel.presenceState() : {};
                this.handlePresenceState(state);
            });
            channel.on('presence', { event: 'leave' }, () => {
                const state = typeof channel.presenceState === 'function' ? channel.presenceState() : {};
                this.handlePresenceState(state);
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
            await this.refreshPresenceTracking();
            const currentPresence = typeof channel.presenceState === 'function' ? channel.presenceState() : {};
            this.handlePresenceState(currentPresence);
        }

        handleRealtimePayload(payload) {
            const row = payload && payload.new ? payload.new : null;
            if (!row || !row.state) return;

            const updatedAt = toTimestamp(row.updated_at, Date.now());
            const updatedBy = row.updated_by || '';
            const remoteState = sanitizeState(row.state);
            const remoteRevision = toNonNegativeInt(remoteState.meta && remoteState.meta.syncRevision, 0);

            if (updatedBy && updatedBy === this.sync.instanceId) return;
            if (remoteRevision && remoteRevision <= this.sync.lastKnownRemoteRevision && updatedAt <= this.sync.lastRemoteSeenAt) return;
            if (!remoteRevision && updatedAt && updatedAt <= this.sync.lastRemoteSeenAt) return;

            this.sync.lastRemoteSeenAt = updatedAt;
            this.sync.lastCloudStateSig = JSON.stringify(stripLocalOnlyFieldsForCloud(remoteState));
            const localRevision = toNonNegativeInt(this.state.meta && this.state.meta.syncRevision, 0);
            const hasLocalDirty = !!(this.sync.localDirtyScopes && this.sync.localDirtyScopes.size);
            if (hasLocalDirty && remoteRevision > localRevision) {
                const conflict = this.buildConflictRecord({
                    state: remoteState,
                    revision: remoteRevision,
                    updatedAt,
                    updatedAtRaw: row.updated_at || '',
                    updatedBy,
                    updatedByName: row.updated_by_name || ''
                }, this.getDirtyScopesSnapshot());
                if (conflict.overlappingScopes.length) {
                    this.setPendingConflict(conflict);
                    return;
                }
                this.adoptMergedConflictState(conflict, 'auto-merge-realtime');
                return;
            }
            const applied = this.applyRemoteState(remoteState, {
                source: 'realtime',
                updatedAt,
                updatedBy,
                revision: remoteRevision
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

            const fetched = await this.fetchCloudRow({ silent });
            if (!fetched.ok) {
                return fetched;
            }

            if (!fetched.row) {
                return { ok: true, reason: 'empty', applied: false };
            }
            const row = fetched.row;

            this.sync.lastCloudStateSig = JSON.stringify(stripLocalOnlyFieldsForCloud(row.state));

            const remoteUpdatedAt = toTimestamp(row.updatedAt, 0);
            const remoteRevision = toNonNegativeInt(row.revision, 0);
            const localRevision = toNonNegativeInt(this.state.meta && this.state.meta.syncRevision, 0);
            const localUpdatedAt = toTimestamp(this.state.meta.updated, 0);
            const hasLocalDirty = !!(this.sync.localDirtyScopes && this.sync.localDirtyScopes.size);
            if (!force && hasLocalDirty && remoteRevision > localRevision) {
                const conflict = this.buildConflictRecord(row, this.getDirtyScopesSnapshot());
                if (conflict.overlappingScopes.length) {
                    this.setPendingConflict(conflict);
                    return { ok: false, reason: 'conflict', conflict: this.getPendingConflict() };
                }
                this.adoptMergedConflictState(conflict, 'auto-merge-pull');
                this.sync.lastPullAt = Date.now();
                return { ok: true, reason: 'merged', applied: false, merged: true };
            }
            const shouldApply = force
                || (remoteRevision > localRevision)
                || (remoteRevision === localRevision && remoteUpdatedAt > localUpdatedAt);

            if (!shouldApply) {
                if (localRevision > remoteRevision || localUpdatedAt > remoteUpdatedAt) {
                    this.scheduleCloudPush('catch-up');
                }
                this.sync.lastPullAt = Date.now();
                this.sync.lastKnownRemoteRevision = Math.max(this.sync.lastKnownRemoteRevision, remoteRevision);
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
                updatedBy: row.updatedBy,
                revision: remoteRevision,
                force
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
            const force = !!opts.force;
            const startAttempt = toNonNegativeInt(opts.attempt, 0);
            const dirtyScopes = this.getDirtyScopesSnapshot(opts.scopes);

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
                let baseRevision = toNonNegativeInt(
                    opts.baseRevision !== undefined ? opts.baseRevision : (this.state.meta && this.state.meta.syncRevision),
                    toNonNegativeInt(this.state.meta && this.state.meta.syncRevision, 0)
                );

                for (let attempt = startAttempt; attempt <= 2; attempt += 1) {
                    this.touchSoftLockScopes(dirtyScopes);
                    const lockConflicts = this.getRemoteLockConflicts(dirtyScopes);
                    if (lockConflicts.length && !force) {
                        this.updateSyncStatus({
                            mode: 'locked',
                            pendingPush: true,
                            message: 'Another player is actively editing one of these scopes.',
                            lastError: ''
                        });
                        return { ok: false, reason: 'locked', locks: lockConflicts };
                    }

                    const payloadState = stripLocalOnlyFieldsForCloud(this.state);
                    const nextSig = JSON.stringify(payloadState);
                    const hasLocalDirty = !!(this.sync.localDirtyScopes && this.sync.localDirtyScopes.size);
                    if (nextSig === this.sync.lastCloudStateSig && !hasLocalDirty) {
                        this.updateSyncStatus({
                            mode: 'ready',
                            connected: true,
                            pendingPush: false
                        });
                        return { ok: true, reason: 'no-change' };
                    }

                    const fetched = await this.fetchCloudRow({ silent: true });
                    if (!fetched.ok) return fetched;
                    const remoteRow = fetched.row;
                    const remoteRevision = remoteRow ? toNonNegativeInt(remoteRow.revision, 0) : 0;

                    if (remoteRow && remoteRevision > baseRevision) {
                        const conflict = this.buildConflictRecord(remoteRow, dirtyScopes);
                        if (!conflict.overlappingScopes.length && attempt < 2) {
                            this.state = sanitizeState(conflict.mergedState);
                            this.syncActiveCaseLegacyState();
                            this.ensureCampaignEntityIds(false);
                            this.markLocalDirtyScopes(dirtyScopes, Date.now());
                            try {
                                localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
                            } catch (writeErr) {
                                console.warn('RTF_STORE: Failed writing merged local state', writeErr);
                            }
                            baseRevision = conflict.remoteRevision;
                            continue;
                        }
                        this.setPendingConflict(conflict);
                        return { ok: false, reason: 'conflict', conflict: this.getPendingConflict() };
                    }

                    const nextRevision = Math.max(baseRevision, remoteRevision) + 1;
                    const updatedAt = Date.now();
                    payloadState.meta.updated = updatedAt;
                    payloadState.meta.syncRevision = nextRevision;
                    payloadState.meta.scopeUpdated = sanitizeScopeUpdatedMap(this.state.meta && this.state.meta.scopeUpdated);

                    this.state.meta.updated = updatedAt;
                    this.state.meta.syncRevision = nextRevision;
                    this.sync.lastKnownRemoteRevision = nextRevision;

                    const rowPayload = {
                        campaign_id: config.campaignId,
                        state: payloadState,
                        updated_at: new Date(updatedAt).toISOString(),
                        updated_by: this.sync.instanceId,
                        updated_by_user: this.sync.userId || null,
                        updated_by_name: config.profileName || null
                    };

                    let result = null;
                    let written = null;
                    if (remoteRow) {
                        result = await this.sync.client
                            .from(config.tableName)
                            .update(rowPayload)
                            .eq('campaign_id', config.campaignId)
                            .eq('updated_at', remoteRow.updatedAtRaw)
                            .select('state,updated_at,updated_by,updated_by_name');
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
                        if (Array.isArray(result.data) && result.data.length) written = result.data[0];
                        else if (result.data && typeof result.data === 'object') written = result.data;
                    } else {
                        result = await this.sync.client
                            .from(config.tableName)
                            .insert(rowPayload)
                            .select('state,updated_at,updated_by,updated_by_name')
                            .maybeSingle();
                        if (result.error) {
                            const code = result.error.code || '';
                            if (code !== '23505') {
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
                        } else {
                            written = result.data;
                        }
                    }

                    if (!written) {
                        const latest = await this.fetchCloudRow({ silent: true });
                        if (!latest.ok) return latest;
                        if (!latest.row) return { ok: false, reason: 'conflict' };
                        const conflict = this.buildConflictRecord(latest.row, dirtyScopes);
                        if (!conflict.overlappingScopes.length && attempt < 2) {
                            this.state = sanitizeState(conflict.mergedState);
                            this.syncActiveCaseLegacyState();
                            this.ensureCampaignEntityIds(false);
                            this.markLocalDirtyScopes(dirtyScopes, Date.now());
                            try {
                                localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
                            } catch (writeErr) {
                                console.warn('RTF_STORE: Failed writing merged local state', writeErr);
                            }
                            baseRevision = conflict.remoteRevision;
                            continue;
                        }
                        this.setPendingConflict(conflict);
                        return { ok: false, reason: 'conflict', conflict: this.getPendingConflict() };
                    }

                    try {
                        localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
                    } catch (writeErr) {
                        console.warn('RTF_STORE: Failed updating local timestamp after cloud push', writeErr);
                    }

                    this.clearLocalDirtyScopes(dirtyScopes);
                    this.sync.lastPushAt = Date.now();
                    this.sync.lastCloudStateSig = JSON.stringify(stripLocalOnlyFieldsForCloud(payloadState));
                    this.sync.lastSyncedState = sanitizeState(this.state);
                    this.clearPendingConflict({ keepStatus: true });
                    const seenAt = toTimestamp(written.updated_at, this.sync.lastPushAt);
                    if (seenAt > this.sync.lastRemoteSeenAt) this.sync.lastRemoteSeenAt = seenAt;

                    this.updateSyncStatus({
                        mode: 'ready',
                        connected: true,
                        pendingPush: false,
                        lastPushAt: this.sync.lastPushAt,
                        message: 'Cloud sync updated.',
                        lastError: ''
                    });

                    return { ok: true, revision: nextRevision };
                }

                return { ok: false, reason: 'conflict' };
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
            const cleaned = mergeRemoteBoardWithLocalLayout(remoteState, this.state);
            const localUpdated = toTimestamp(this.state.meta.updated, 0);
            const remoteUpdated = toTimestamp(meta.updatedAt, toTimestamp(cleaned.meta.updated, Date.now()));
            const localRevision = toNonNegativeInt(this.state.meta && this.state.meta.syncRevision, 0);
            const remoteRevision = toNonNegativeInt(meta.revision, toNonNegativeInt(cleaned.meta && cleaned.meta.syncRevision, 0));

            if (!meta.force && remoteRevision && remoteRevision < localRevision) return false;
            const shouldApplyByRevision = remoteRevision ? remoteRevision > localRevision : false;
            if (!meta.force && !shouldApplyByRevision && remoteUpdated <= localUpdated) return false;

            this.isApplyingRemote = true;
            cleaned.meta.updated = remoteUpdated;
            cleaned.meta.syncRevision = remoteRevision || toNonNegativeInt(cleaned.meta.syncRevision, 0);
            this.state = cleaned;
            this.ensureCampaignEntityIds(false);
            this.syncActiveCaseLegacyState();

            try {
                localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
            } catch (err) {
                console.error('RTF_STORE: Failed writing remote state locally', err);
            }

            this.isApplyingRemote = false;
            this.sync.lastKnownRemoteRevision = Math.max(this.sync.lastKnownRemoteRevision, toNonNegativeInt(this.state.meta.syncRevision, 0));
            this.sync.lastSyncedState = sanitizeState(this.state);
            if (meta.clearDirty !== false) this.clearLocalDirtyScopes();
            if (this.sync.pendingConflict && remoteRevision >= toNonNegativeInt(this.sync.pendingConflict.remoteRevision, 0)) {
                this.sync.pendingConflict = null;
            }
            this.broadcastStoreUpdate('remote', {
                source: meta.source || 'remote',
                updatedAt: remoteUpdated,
                updatedBy: meta.updatedBy || '',
                revision: toNonNegativeInt(this.state.meta.syncRevision, 0)
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
            const handlers = ['render', 'renderRequisitions', 'renderTimeline', 'renderEncounters', 'renderCaseSwitcher'];
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
            const source = player && typeof player === 'object' ? player : {};
            const generatedId = 'player_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5);
            const rawHp = source.hp;
            const safeHp = (typeof rawHp === 'number' && Number.isFinite(rawHp))
                ? Math.max(0, Math.min(999999, Math.round(rawHp)))
                : toTrimmedString(rawHp, '10', 40);

            this.state.campaign.players.push({
                id: toTrimmedString(source.id || generatedId, generatedId, 80),
                name: toTrimmedString(source.name || 'New Agent', 'New Agent', 160),
                ac: Math.max(0, Math.min(999, Math.round(toNumber(source.ac, 10)))),
                hp: safeHp,
                pp: Math.max(0, Math.min(999, Math.round(toNumber(source.pp, 10)))),
                dc: Math.max(0, Math.min(999, Math.round(toNumber(source.dc, 10)))),
                dp: Math.max(0, Math.min(4, Math.round(toNumber(source.dp, 2)))),
                projectClock: Math.max(0, Math.min(6, Math.round(toNumber(source.projectClock, 0)))),
                projectName: toTrimmedString(source.projectName, '', 240),
                projectReward: toTrimmedString(source.projectReward, '', 240)
            });
            this.save({ scope: 'campaign.players' });
        }

        addNPC(npc) {
            const source = npc && typeof npc === 'object' ? { ...npc } : {};
            if (Object.prototype.hasOwnProperty.call(source, 'imageUrl')) {
                source.imageUrl = toImageUrl(source.imageUrl);
            }
            this.state.campaign.npcs.push(source);
            this.save({ scope: 'campaign.npcs' });
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
                    this.save({ scope: 'campaign.players' });
                } catch (err) {
                    console.warn('RTF_STORE: Failed to persist player IDs', err);
                }
            }
        }

        ensureCampaignEntityIds(persist = true) {
            this.ensurePlayerIds(false);
            if (!this.state.campaign || typeof this.state.campaign !== 'object') return;

            let mutated = false;
            const ensureListIds = (list, prefix) => {
                if (!Array.isArray(list)) return;
                const seen = new Set();

                list.forEach((entry, idx) => {
                    if (!entry || typeof entry !== 'object') return;

                    let candidate = toTrimmedString(entry.id, '', 80).trim();
                    if (candidate && !seen.has(candidate)) {
                        if (entry.id !== candidate) {
                            entry.id = candidate;
                            mutated = true;
                        }
                        seen.add(candidate);
                        return;
                    }

                    let bump = 0;
                    do {
                        candidate = buildEntityId(prefix, idx, bump);
                        bump += 1;
                    } while (seen.has(candidate));

                    entry.id = candidate;
                    seen.add(candidate);
                    mutated = true;
                });
            };

            ensureListIds(this.state.campaign.npcs, 'npc');
            ensureListIds(this.state.campaign.locations, 'loc');

            if (mutated && persist) {
                try {
                    this.save({ scope: ['campaign.npcs', 'campaign.locations'] });
                } catch (err) {
                    console.warn('RTF_STORE: Failed to persist campaign entity IDs', err);
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
            const source = req && typeof req === 'object' ? req : {};
            const sanitized = {
                id: toTrimmedString(source.id || ('req_' + Date.now()), 'req_' + Date.now(), 80),
                item: toTrimmedString(source.item, '', 240),
                requester: toTrimmedString(source.requester, '', 160),
                guild: toTrimmedString(source.guild, '', 120),
                priority: REQUISITION_PRIORITIES.has(toTrimmedString(source.priority, '', 40))
                    ? toTrimmedString(source.priority, 'Routine', 40)
                    : 'Routine',
                status: REQUISITION_STATUSES.has(toTrimmedString(source.status, '', 40))
                    ? toTrimmedString(source.status, 'Pending', 40)
                    : 'Pending',
                value: toTrimmedString(source.value, '', 120),
                imageUrl: toImageUrl(source.imageUrl),
                purpose: toTrimmedString(source.purpose, '', 4000),
                notes: toTrimmedString(source.notes, '', 4000),
                tags: toTrimmedString(source.tags, '', 4000),
                created: toTrimmedString(source.created || new Date().toISOString(), new Date().toISOString(), 80)
            };
            this.getRequisitions().push(sanitized);
            this.save({ scope: 'campaign.requisitions' });
            return sanitized.id;
        }

        updateRequisition(id, updates) {
            const list = this.getRequisitions();
            const idx = list.findIndex(r => r.id === id);
            if (idx >= 0) {
                const patch = sanitizePatch(updates, {
                    item: (v) => toTrimmedString(v, '', 240),
                    requester: (v) => toTrimmedString(v, '', 160),
                    guild: (v) => toTrimmedString(v, '', 120),
                    priority: (v) => {
                        const normalized = toTrimmedString(v, '', 40);
                        return REQUISITION_PRIORITIES.has(normalized) ? normalized : 'Routine';
                    },
                    status: (v) => {
                        const normalized = toTrimmedString(v, '', 40);
                        return REQUISITION_STATUSES.has(normalized) ? normalized : 'Pending';
                    },
                    value: (v) => toTrimmedString(v, '', 120),
                    imageUrl: (v) => toImageUrl(v),
                    purpose: (v) => toTrimmedString(v, '', 4000),
                    notes: (v) => toTrimmedString(v, '', 4000),
                    tags: (v) => toTrimmedString(v, '', 4000),
                    created: (v) => toTrimmedString(v, '', 80)
                });
                if (!patch) return;
                list[idx] = { ...list[idx], ...patch };
                this.save({ scope: 'campaign.requisitions' });
            }
        }

        deleteRequisition(id) {
            const list = this.getRequisitions();
            const idx = list.findIndex(r => r.id === id);
            if (idx >= 0) {
                list.splice(idx, 1);
                this.save({ scope: 'campaign.requisitions' });
            }
        }

        // Mission Events
        getEvents(caseId = null) {
            const entry = this.getCaseEntry(caseId, { createIfMissing: true });
            return entry ? entry.events : [];
        }

        addEvent(evt, caseId = null) {
            const source = evt && typeof evt === 'object' ? evt : {};
            const safeEvent = {
                id: toTrimmedString(source.id || ('event_' + Date.now()), 'event_' + Date.now(), 80),
                title: toTrimmedString(source.title, '', 240),
                focus: toTrimmedString(source.focus, '', 240),
                heatDelta: toTrimmedString(source.heatDelta, '', 12),
                tags: toTrimmedString(source.tags, '', 2000),
                imageUrl: toImageUrl(source.imageUrl),
                highlights: toTrimmedString(source.highlights, '', 6000),
                fallout: toTrimmedString(source.fallout, '', 6000),
                followUp: toTrimmedString(source.followUp, '', 6000),
                source: toTrimmedString(source.source, '', 80),
                kind: toTrimmedString(source.kind, '', 80),
                resolved: toBoolean(source.resolved),
                created: toTrimmedString(source.created || new Date().toISOString(), new Date().toISOString(), 80)
            };
            const entry = this.getCaseEntry(caseId, { createIfMissing: true });
            if (!entry) return '';
            entry.events.push({ ...safeEvent, caseId: entry.id });
            this.syncActiveCaseLegacyState();
            this.save({ scope: `cases.${entry.id}.events` });
            return safeEvent.id;
        }

        updateEvent(id, updates, caseId = null) {
            const list = this.getEvents(caseId);
            const idx = list.findIndex(e => e.id === id);
            if (idx >= 0) {
                const patch = sanitizePatch(updates, {
                    title: (v) => toTrimmedString(v, '', 240),
                    focus: (v) => toTrimmedString(v, '', 240),
                    heatDelta: (v) => toTrimmedString(v, '', 12),
                    tags: (v) => toTrimmedString(v, '', 2000),
                    imageUrl: (v) => toImageUrl(v),
                    highlights: (v) => toTrimmedString(v, '', 6000),
                    fallout: (v) => toTrimmedString(v, '', 6000),
                    followUp: (v) => toTrimmedString(v, '', 6000),
                    source: (v) => toTrimmedString(v, '', 80),
                    kind: (v) => toTrimmedString(v, '', 80),
                    resolved: (v) => toBoolean(v),
                    created: (v) => toTrimmedString(v, '', 80)
                });
                if (!patch) return;
                list[idx] = { ...list[idx], ...patch };
                this.syncActiveCaseLegacyState();
                const activeCase = this.getCaseEntry(caseId);
                const scopeId = activeCase && activeCase.id ? activeCase.id : this.getActiveCaseId();
                this.save({ scope: `cases.${scopeId}.events` });
            }
        }

        deleteEvent(id, caseId = null) {
            const list = this.getEvents(caseId);
            const idx = list.findIndex(e => e.id === id);
            if (idx >= 0) {
                list.splice(idx, 1);
                this.syncActiveCaseLegacyState();
                const activeCase = this.getCaseEntry(caseId);
                const scopeId = activeCase && activeCase.id ? activeCase.id : this.getActiveCaseId();
                this.save({ scope: `cases.${scopeId}.events` });
            }
        }

        // Encounter Recipes
        getEncounters() {
            return this.state.campaign.encounters || [];
        }

        addEncounter(enc) {
            const source = enc && typeof enc === 'object' ? enc : {};
            const safeEncounter = {
                id: toTrimmedString(source.id || ('enc_' + Date.now()), 'enc_' + Date.now(), 80),
                title: toTrimmedString(source.title, '', 240),
                tier: ENCOUNTER_TIERS.has(toTrimmedString(source.tier, '', 40))
                    ? toTrimmedString(source.tier, 'Routine', 40)
                    : 'Routine',
                location: toTrimmedString(source.location, '', 240),
                objective: toTrimmedString(source.objective, '', 2000),
                opposition: toTrimmedString(source.opposition, '', 6000),
                hazards: toTrimmedString(source.hazards, '', 6000),
                beats: toTrimmedString(source.beats, '', 6000),
                rewards: toTrimmedString(source.rewards, '', 6000),
                notes: toTrimmedString(source.notes, '', 6000),
                created: toTrimmedString(source.created || new Date().toISOString(), new Date().toISOString(), 80)
            };
            this.getEncounters().push(safeEncounter);
            this.save({ scope: 'campaign.encounters' });
            return safeEncounter.id;
        }

        updateEncounter(id, updates) {
            const list = this.getEncounters();
            const idx = list.findIndex(e => e.id === id);
            if (idx >= 0) {
                const patch = sanitizePatch(updates, {
                    title: (v) => toTrimmedString(v, '', 240),
                    tier: (v) => {
                        const normalized = toTrimmedString(v, '', 40);
                        return ENCOUNTER_TIERS.has(normalized) ? normalized : 'Routine';
                    },
                    location: (v) => toTrimmedString(v, '', 240),
                    objective: (v) => toTrimmedString(v, '', 2000),
                    opposition: (v) => toTrimmedString(v, '', 6000),
                    hazards: (v) => toTrimmedString(v, '', 6000),
                    beats: (v) => toTrimmedString(v, '', 6000),
                    rewards: (v) => toTrimmedString(v, '', 6000),
                    notes: (v) => toTrimmedString(v, '', 6000),
                    created: (v) => toTrimmedString(v, '', 80)
                });
                if (!patch) return;
                list[idx] = { ...list[idx], ...patch };
                this.save({ scope: 'campaign.encounters' });
            }
        }

        deleteEncounter(id) {
            const list = this.getEncounters();
            const idx = list.findIndex(e => e.id === id);
            if (idx >= 0) {
                list.splice(idx, 1);
                this.save({ scope: 'campaign.encounters' });
            }
        }

        getBoard(caseId = null) {
            const entry = this.getCaseEntry(caseId, { createIfMissing: true });
            if (!entry) return sanitizeBoard(null);
            entry.board = sanitizeBoard(entry.board);
            if (!caseId || entry.id === this.getActiveCaseId()) this.syncActiveCaseLegacyState();
            return entry.board;
        }

        updateBoard(boardState, caseId = null) {
            const entry = this.getCaseEntry(caseId, { createIfMissing: true });
            if (!entry) return;
            entry.board = sanitizeBoard(boardState);
            this.syncActiveCaseLegacyState();
            this.save({ scope: `cases.${entry.id}.board` });
        }

        clearBoard(caseId = null) {
            const entry = this.getCaseEntry(caseId, { createIfMissing: true });
            if (!entry) return;
            entry.board = sanitizeBoard(null);
            this.syncActiveCaseLegacyState();
            this.save({ scope: `cases.${entry.id}.board` });
        }

        getHQLayout() {
            this.state.hq = sanitizeHQ(this.state.hq);
            return deepClone(this.state.hq);
        }

        updateHQLayout(hqState) {
            this.state.hq = sanitizeHQ(hqState);
            this.save({ scope: 'hq' });
        }
    }

    global.RTF_STORE = new Store();

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
