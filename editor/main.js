import { initEditorCore } from './EditorCore.js';
import { initUIManager } from './UIManager.js';

// Punto de entrada principal
document.addEventListener('DOMContentLoaded', () => {
    initEditorCore();
    initUIManager();
});
