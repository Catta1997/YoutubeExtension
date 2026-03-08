// Carica al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    const highlightCheckbox = document.getElementById('toggleHighlight');
    const deletedCheckbox   = document.getElementById('toggleDeleted');
    const highlightModerators   = document.getElementById('toggleHighlightModerator');
    const highlightMentions   = document.getElementById('toggleHighlightMentions');
    const highlightNewUserCheckbox   = document.getElementById('togglehighlightNewUser');

    // Carica le impostazioni salvate (default: true)
    chrome.storage.sync.get({
        highlightEnabled: true,
        highlightMods: true,
        highlightMentions: true,
        deletedEnabled: true,
        newUserEnabled: true,
    }, prefs => {
        highlightCheckbox.checked = prefs.highlightEnabled;
        highlightMentions.checked = prefs.highlightMentions;
        deletedCheckbox.checked   = prefs.deletedEnabled;
        highlightModerators.checked = prefs.highlightMods;
        highlightNewUserCheckbox.checked = prefs.newUserEnabled;
    });

    // Al cambiamento salva su storage.sync
    highlightMentions.addEventListener('change', () => {
        chrome.storage.sync.set({ highlightMentions: highlightMentions.checked });
    });
    highlightModerators.addEventListener('change', () => {
        chrome.storage.sync.set({ highlightMods: highlightModerators.checked });
    });
    highlightCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ highlightEnabled: highlightCheckbox.checked });
    });
    deletedCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ deletedEnabled: deletedCheckbox.checked });
    });
    highlightNewUserCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ newUserEnabled: highlightNewUserCheckbox.checked });
    });
});
