export const UI = {
    toggleAccordion(trigger) {
        trigger.classList.toggle('collapsed');
        const content = trigger.parentElement.nextElementSibling;
        if (content) {
            content.classList.toggle('collapsed');
            const card = trigger.closest('.card');
            if (card) {
                if (content.classList.contains('collapsed')) card.classList.add('card-collapsed');
                else card.classList.remove('card-collapsed');
            }
        }
    },

    showLog(logAreaId, formulaText, total, isCrit, isFail) {
        const area = document.getElementById(logAreaId);
        if (!area) return;

        const formulaEl = area.querySelector('.log-formula');
        const resultEl = area.querySelector('.log-result');

        if (formulaEl) formulaEl.innerText = formulaText;
        if (resultEl) {
            resultEl.innerText = total;
            resultEl.className = 'log-result';
            if (isCrit) resultEl.classList.add('crit-text');
            if (isFail) resultEl.classList.add('fail-text');

            // Re-trigger animation
            resultEl.style.animation = 'none';
            resultEl.offsetHeight;
            resultEl.style.animation = 'fadeIn 0.2s ease-out';
        }
    }
};
