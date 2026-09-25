import { Game } from './engine/Game.js';
import { HUD } from './ui/HUD.js';

async function boot() {
  const tempHud = new HUD();
  tempHud.setLoadingProgress(0.15, 'Chargement du moteur 3D…');

  try {
    const game = new Game();
    tempHud.setLoadingProgress(0.7, 'Plantation du jardin…');
    game.start();
  } catch (err) {
    console.error('Fatal error while starting the game:', err);
    tempHud.setLoadingProgress(1, "Une erreur est survenue. Recharge la page.");
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

boot();
