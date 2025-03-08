import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { io } from 'socket.io-client';
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
