'use strict';
(() => {
    const button = document.getElementById('import-pack'), input = document.getElementById('import-file'), status = document.getElementById('import-status');
    const show = text => { status.hidden = false; status.textContent = text; };
    // The server decides; a LAN browser can also open a page with a local-
    // looking hostname. The import endpoint independently checks every POST.
    fetch('/api/capabilities', { cache: 'no-store' }).then(response => response.ok ? response.json() : null)
        .then(capabilities => { button.hidden = capabilities?.manageServer !== true; })
        .catch(() => { button.hidden = true; });
    button.onclick = () => input.click();
    input.onchange = async () => {
        const file = input.files[0]; input.value = ''; if (!file) return;
        if (file.size > 65 * 1024 * 1024) { show('Choose a game ZIP smaller than 65 MiB.'); return; }
        button.disabled = true; show('Checking and installing your game…');
        try {
            const response = await fetch('/library/import', { method: 'POST', headers: { 'Content-Type': 'application/zip', 'X-Homegames-Import': '1' }, body: file });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not import game');
            location.href = '/?gameId=' + encodeURIComponent(result.gameKey) + '&versionId=' + encodeURIComponent(result.versionId);
        } catch (error) { show(error.message); }
        finally { button.disabled = false; }
    };
})();
