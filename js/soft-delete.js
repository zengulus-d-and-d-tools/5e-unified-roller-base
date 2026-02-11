(function (global) {
    const DEFAULT_UNDO_MS = 12000;

    function toDurationLabel(ms) {
        const seconds = Math.max(0, Math.ceil(ms / 1000));
        return `${seconds}s`;
    }

    function createSoftDeleteManager(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const undoMs = Number.isFinite(Number(opts.undoMs))
            ? Math.max(3000, Number(opts.undoMs))
            : DEFAULT_UNDO_MS;
        const host = opts.host instanceof Element ? opts.host : document.body;
        const toastClass = typeof opts.toastClass === 'string' ? opts.toastClass.trim() : '';
        const onStateChange = typeof opts.onStateChange === 'function' ? opts.onStateChange : null;

        const toast = document.createElement('div');
        toast.className = `soft-delete-toast${toastClass ? ` ${toastClass}` : ''}`;
        toast.hidden = true;
        toast.innerHTML = `
            <span class="soft-delete-toast__message"></span>
            <span class="soft-delete-toast__meta"></span>
            <button type="button" class="btn btn-dp soft-delete-toast__undo">Undo</button>
        `;

        const messageEl = toast.querySelector('.soft-delete-toast__message');
        const metaEl = toast.querySelector('.soft-delete-toast__meta');
        const undoBtn = toast.querySelector('.soft-delete-toast__undo');

        host.appendChild(toast);

        let pending = null;
        let finalizeTimer = null;
        let countdownTimer = null;

        function emitState(type) {
            if (!onStateChange) return;
            onStateChange({
                type,
                pendingId: pending ? pending.id : ''
            });
        }

        function clearTimers() {
            if (finalizeTimer) {
                clearTimeout(finalizeTimer);
                finalizeTimer = null;
            }
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
        }

        function hideToast() {
            toast.hidden = true;
            if (messageEl) messageEl.textContent = '';
            if (metaEl) metaEl.textContent = '';
        }

        function renderToast() {
            if (!pending) {
                hideToast();
                return;
            }
            const remainingMs = Math.max(0, pending.expiresAt - Date.now());
            if (messageEl) messageEl.textContent = pending.label || 'Deleted entry.';
            if (metaEl) metaEl.textContent = `Undo available for ${toDurationLabel(remainingMs)}`;
            toast.hidden = false;
        }

        function completePending(reason) {
            if (!pending) return false;
            const current = pending;
            pending = null;
            clearTimers();
            hideToast();

            try {
                current.onFinalize(reason);
            } catch (err) {
                console.error('Soft delete finalize failed:', err);
            }

            emitState('finalized');
            return true;
        }

        function undoPending() {
            if (!pending) return false;
            const current = pending;
            pending = null;
            clearTimers();
            hideToast();

            if (typeof current.onUndo === 'function') {
                try {
                    current.onUndo();
                } catch (err) {
                    console.error('Soft delete undo callback failed:', err);
                }
            }

            emitState('undone');
            return true;
        }

        function schedule(entry) {
            const source = entry && typeof entry === 'object' ? entry : null;
            if (!source || !source.id || typeof source.onFinalize !== 'function') return false;

            if (pending) {
                completePending('replaced');
            }

            pending = {
                id: String(source.id),
                label: String(source.label || 'Deleted entry.'),
                expiresAt: Date.now() + undoMs,
                onFinalize: source.onFinalize,
                onUndo: typeof source.onUndo === 'function' ? source.onUndo : null
            };

            clearTimers();
            renderToast();

            finalizeTimer = setTimeout(() => {
                completePending('timeout');
            }, undoMs);

            countdownTimer = setInterval(() => {
                renderToast();
            }, 250);

            emitState('scheduled');
            return true;
        }

        function isPending(id) {
            if (!pending) return false;
            return String(pending.id) === String(id);
        }

        function getPendingId() {
            return pending ? pending.id : '';
        }

        function flush() {
            return completePending('flush');
        }

        function dispose() {
            clearTimers();
            pending = null;
            hideToast();
            toast.remove();
        }

        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                undoPending();
            });
        }

        return {
            schedule,
            isPending,
            getPendingId,
            undo: undoPending,
            flush,
            dispose
        };
    }

    global.RTF_SOFT_DELETE = {
        createSoftDeleteManager
    };
})(window);
