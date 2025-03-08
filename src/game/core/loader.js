import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSETS_CONFIG } from './config';

/**
 * Classe para gerenciar o carregamento de recursos
 */
export class ResourceLoader {
  constructor(onProgress, onComplete) {
    this.gltfLoader = new GLTFLoader();
    this.resources = {};
    this.totalAssets = ASSETS_CONFIG.models.length;
    this.loadedAssets = 0;
    this.onProgress = onProgress || (() => {});
    this.onComplete = onComplete || (() => {});
  }

  /**
   * Carrega todos os modelos definidos na configuração
   */
  loadAllModels() {
    return Promise.all(
      ASSETS_CONFIG.models.map(model => this.loadModel(model.name, model.path))
    ).then(() => {
      this.onComplete(this.resources);
      return this.resources;
    });
  }

  /**
   * Carrega um modelo GLTF
   * @param {string} name - Nome de referência do modelo
   * @param {string} path - Caminho para o arquivo do modelo
   * @returns {Promise} Promessa resolvida quando o modelo for carregado
   */
  loadModel(name, path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          console.log(`Modelo ${name} carregado com sucesso`);
          this.resources[name] = gltf.scene;
          this.loadedAssets++;
          this.onProgress(this.loadedAssets / this.totalAssets);
          resolve(gltf.scene);
        },
        (xhr) => {
          console.log(`Carregando modelo ${name}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
        },
        (error) => {
          console.error(`Erro ao carregar o modelo ${path}:`, error);
          this.loadedAssets++;
          this.onProgress(this.loadedAssets / this.totalAssets);
          reject(error);
        }
      );
    });
  }

  /**
   * Função para pré-carregar recursos críticos antes de iniciar o jogo
   * @returns {Promise} Promessa resolvida quando os recursos críticos forem carregados
   */
  preloadCriticalResources() {
    return new Promise((resolve) => {
      // Simular o carregamento de recursos críticos
      setTimeout(() => {
        this.onProgress(0.1); // +10% após pré-carregamento
        resolve();
      }, 200);
    });
  }
} 