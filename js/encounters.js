(function () {
    const TIERS = [
        { value: 'Routine', color: '#7f8c8d' },
        { value: 'Standard', color: 'var(--accent)' },
        { value: 'Elite', color: '#f1c40f' },
        { value: 'Boss', color: 'var(--danger)' }
    ];

    const escapeHtml = (str = '') => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getStore = () => window.RTF_STORE;

    function populateTierSelects() {
        const tierSelect = document.getElementById('encTier');
        if (tierSelect && tierSelect.options.length === 0) {
            tierSelect.innerHTML = TIERS.map(t => `<option value="${t.value}">${t.value}</option>`).join('');
        }
        const tierFilter = document.getElementById('encTierFilter');
        if (tierFilter && tierFilter.options.length === 1) {
            TIERS.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.value;
                opt.textContent = t.value;
                tierFilter.appendChild(opt);
            });
        }
    }

    function toggleEncForm() {
        const form = document.getElementById('encForm');
        if (!form) return;
        populateTierSelects();
        if (form.style.display === 'block') {
            form.style.display = 'none';
        } else {
            form.style.display = 'block';
            document.getElementById('encTitle').focus();
        }
    }

    function resetForm() {
        ['encTitle', 'encLocation', 'encObjective', 'encOpposition', 'encHazards', 'encBeats', 'encRewards', 'encNotes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const tierSelect = document.getElementById('encTier');
        if (tierSelect) tierSelect.value = 'Routine';
    }

    function addEncounter() {
        const store = getStore();
        if (!store) return;
        const title = document.getElementById('encTitle').value.trim();
        if (!title) {
            alert('Encounter name required.');
            return;
        }
        const enc = {
            id: 'enc_' + Date.now(),
            title,
            tier: document.getElementById('encTier').value,
            location: document.getElementById('encLocation').value,
            objective: document.getElementById('encObjective').value,
            opposition: document.getElementById('encOpposition').value,
            hazards: document.getElementById('encHazards').value,
            beats: document.getElementById('encBeats').value,
            rewards: document.getElementById('encRewards').value,
            notes: document.getElementById('encNotes').value,
            created: new Date().toISOString()
        };
        store.addEncounter(enc);
        resetForm();
        toggleEncForm();
        renderEncounters();
    }

    function updateEncField(id, field, value) {
        const store = getStore();
        if (!store) return;
        store.updateEncounter(id, { [field]: value });
        renderEncounters();
    }

    function deleteEncounter(id) {
        if (!confirm('Delete this encounter recipe?')) return;
        const store = getStore();
        if (!store) return;
        store.deleteEncounter(id);
        renderEncounters();
    }

    function buildTierOptions(selected) {
        return TIERS.map(t => `<option value="${t.value}" ${t.value === (selected || 'Routine') ? 'selected' : ''}>${t.value}</option>`).join('');
    }

    function buildCard(enc) {
        const tierMeta = TIERS.find(t => t.value === enc.tier) || TIERS[0];
        return `
        <div class="enc-card" style="border-left:4px solid ${tierMeta.color};">
            <h3>
                <input type="text" value="${escapeHtml(enc.title || '')}" placeholder="Encounter"
                    onchange="updateEncField('${enc.id}', 'title', this.value)">
                <select class="tier-pill" onchange="updateEncField('${enc.id}', 'tier', this.value)">
                    ${buildTierOptions(enc.tier)}
                </select>
            </h3>
            <div class="enc-grid" style="margin-top:10px;">
                <div>
                    <label style="font-size:0.75rem; text-transform:uppercase; color:#888;">Battlefield</label>
                    <input type="text" value="${escapeHtml(enc.location || '')}" placeholder="Arena"
                        onchange="updateEncField('${enc.id}', 'location', this.value)">
                </div>
                <div>
                    <label style="font-size:0.75rem; text-transform:uppercase; color:#888;">Objective</label>
                    <input type="text" value="${escapeHtml(enc.objective || '')}" placeholder="Goal"
                        onchange="updateEncField('${enc.id}', 'objective', this.value)">
                </div>
            </div>
            <textarea placeholder="Opposition" onchange="updateEncField('${enc.id}', 'opposition', this.value)">${escapeHtml(enc.opposition || '')}</textarea>
            <textarea placeholder="Hazards" onchange="updateEncField('${enc.id}', 'hazards', this.value)">${escapeHtml(enc.hazards || '')}</textarea>
            <textarea placeholder="Beats / Phases" onchange="updateEncField('${enc.id}', 'beats', this.value)">${escapeHtml(enc.beats || '')}</textarea>
            <textarea placeholder="Rewards" onchange="updateEncField('${enc.id}', 'rewards', this.value)">${escapeHtml(enc.rewards || '')}</textarea>
            <textarea placeholder="Notes" onchange="updateEncField('${enc.id}', 'notes', this.value)">${escapeHtml(enc.notes || '')}</textarea>
            <div style="display:flex; justify-content:flex-end; gap:10px; align-items:center;">
                <small style="color:#666; flex:1;">Logged ${enc.created ? new Date(enc.created).toLocaleString() : '—'}</small>
                <button class="btn btn-danger" onclick="deleteEncounter('${enc.id}')">Delete</button>
            </div>
        </div>`;
    }

    function renderEncounters() {
        const store = getStore();
        const container = document.getElementById('encounterList');
        if (!store || !container) return;
        populateTierSelects();
        const search = (document.getElementById('encSearch').value || '').toLowerCase();
        const tierFilter = document.getElementById('encTierFilter').value;

        const list = (store.getEncounters() || []).slice();
        const filtered = list.filter(enc => {
            const text = `${enc.title || ''} ${enc.location || ''} ${enc.objective || ''} ${enc.opposition || ''} ${enc.hazards || ''} ${enc.beats || ''} ${enc.rewards || ''} ${enc.notes || ''}`.toLowerCase();
            const matchesSearch = search ? text.includes(search) : true;
            const matchesTier = tierFilter ? enc.tier === tierFilter : true;
            return matchesSearch && matchesTier;
        });

        filtered.sort((a, b) => (b.created || '').localeCompare(a.created || ''));

        container.innerHTML = filtered.length
            ? filtered.map(buildCard).join('')
            : '<div class="empty-state">No encounter recipes yet.</div>';
    }

    function waitForStore() {
        if (getStore()) {
            renderEncounters();
        } else {
            setTimeout(waitForStore, 100);
        }
    }

    window.toggleEncForm = toggleEncForm;
    window.addEncounter = addEncounter;
    window.renderEncounters = renderEncounters;
    window.updateEncField = updateEncField;
    window.deleteEncounter = deleteEncounter;

    window.addEventListener('load', waitForStore);
})();
