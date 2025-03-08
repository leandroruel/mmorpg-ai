import { MMORPGGame } from './game/core/game';

// Registrar o tempo de início para fins de depuração
window.gameStartTime = Date.now();

// Iniciar o jogo quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  const game = new MMORPGGame();
  
  // Expor o jogo globalmente para depuração
  window.game = game;
  
  // Configurar manipulador para quando a página for fechada
  window.addEventListener('beforeunload', () => {
    game.cleanup();
  });
});
