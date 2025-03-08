import { UserInterface } from './ui';
import { NetworkManager } from './network';
import { ResourceLoader } from './loader';
import { GameRenderer } from '../rendering/renderer';
import { EntityManager } from '../entities/entityManager';
import { InputManager } from '../controls/inputManager';

/**
 * Classe principal do jogo MMORPG
 */
export class MMORPGGame {
  constructor() {
    console.log('Iniciando MMORPG Game...');
    console.time('inicialização');
    
    // Registrar o tempo de início para fins de depuração
    window.gameStartTime = Date.now();
    
    // Criar componentes do jogo
    this.ui = new UserInterface();
    this.networkManager = new NetworkManager();
    this.renderer = new GameRenderer();
    
    // Inicializar componentes
    this.initialize();
  }
  
  /**
   * Inicializa o jogo
   */
  initialize() {
    // Inicializar renderer
    const { scene } = this.renderer.initialize();
    
    // Criar gerenciador de entidades
    this.entityManager = new EntityManager(scene, this.networkManager, this.renderer);
    
    // Configurar gerenciador de input (será configurado após o login)
    this.inputManager = null;
    
    // Criar carregador de recursos
    this.resourceLoader = new ResourceLoader(
      // Callback de progresso
      (progress) => {
        this.ui.updateLoadingProgress(progress * 0.3); // 30% do progresso total
      },
      // Callback de conclusão
      (resources) => {
        console.log('Recursos carregados:', resources);
        this.connect();
      }
    );
    
    // Iniciar carregamento de recursos
    this.preloadResources();
  }
  
  /**
   * Pré-carrega recursos essenciais
   */
  preloadResources() {
    // Atualizar progresso inicial
    this.ui.updateLoadingProgress(0.05);
    
    // Pré-carregar recursos críticos
    this.resourceLoader.preloadCriticalResources()
      .then(() => {
        // Carregar todos os modelos
        return this.resourceLoader.loadAllModels();
      })
      .catch(error => {
        console.error('Erro ao carregar recursos:', error);
        this.ui.showErrorMessage('Erro ao carregar recursos necessários. Por favor, recarregue a página.');
      });
  }
  
  /**
   * Conecta ao servidor de jogo
   */
  connect() {
    // Atualizar progresso
    this.ui.updateLoadingProgress(0.4);
    
    // Configurar eventos de rede ANTES de conectar
    this.setupNetworkEvents();
    
    // Conectar ao servidor APÓS configurar os eventos
    this.networkManager.connect()
      .then(() => {
        console.log('Conectado ao servidor');
        this.ui.updateLoadingProgress(0.6);
        this.showLoginScreen();
      })
      .catch(error => {
        console.error('Erro ao conectar ao servidor:', error);
        this.ui.showErrorMessage('Erro de conexão com o servidor. Verifique se o servidor está rodando e recarregue a página.');
      });
  }
  
  /**
   * Configura os eventos de rede
   */
  setupNetworkEvents() {
    // Evento para receber o estado inicial do jogo
    this.networkManager.on('gameState', (data) => {
      console.log('Estado do jogo recebido:', data);
      
      // Verificar se os dados são válidos
      if (!data || !data.selfId) {
        console.error('Dados do gameState inválidos:', data);
        return;
      }
      
      try {
        // Definir ID do jogador local
        this.entityManager.setLocalPlayerId(data.selfId);
        
        // Criar jogadores
        Object.entries(data.players).forEach(([id, playerData]) => {
          this.entityManager.createOrUpdatePlayer(id, playerData);
        });
        
        // Criar monstros
        Object.entries(data.monsters).forEach(([id, monsterData]) => {
          this.entityManager.createOrUpdateMonster(id, monsterData);
        });
        
        // Atualizar HUD com informações do jogador
        const localPlayer = this.entityManager.getLocalPlayer();
        if (localPlayer) {
          const playerClass = localPlayer.data.class || 'knight';
          const className = playerClass.charAt(0).toUpperCase() + playerClass.slice(1);
          this.ui.updatePlayerInfo(localPlayer.data, className);
          console.log('Jogador local inicializado com sucesso:', localPlayer);
        } else {
          console.error('Jogador local não encontrado após gameState');
        }
        
        // Inicializar controles de input
        this.initializeControls();
      } catch (error) {
        console.error('Erro ao processar gameState:', error);
      }
      
      // Criar solo
      this.renderer.createGround();
      
      // Iniciar animação
      this.renderer.startAnimationLoop();
      
      // Ocultar tela de carregamento
      this.ui.updateLoadingProgress(1.0);
    });
    
    // Evento para quando um jogador entrar
    this.networkManager.on('playerJoined', (player) => {
      console.log('Novo jogador entrou:', player);
      this.entityManager.createOrUpdatePlayer(player.id, player);
    });
    
    // Evento para quando um jogador sair
    this.networkManager.on('playerLeft', (playerId) => {
      console.log('Jogador saiu:', playerId);
      this.entityManager.removePlayer(playerId);
    });
    
    // Evento para quando um jogador se move
    this.networkManager.on('playerMoved', (data) => {
      const player = this.entityManager.createOrUpdatePlayer(data.id, {
        position: data.position
      });
    });
    
    // Evento para quando um monstro recebe dano
    this.networkManager.on('monsterDamaged', (data) => {
      console.log(`Monstro ${data.id} sofreu ${data.damage} de dano. HP: ${data.hp}`);
      this.entityManager.damageMonster(data.id, data.damage);
    });
    
    // Evento para quando um monstro morre
    this.networkManager.on('monsterDied', (monsterId) => {
      console.log(`Monstro ${monsterId} morreu!`);
      
      // Atualizar o estado do monstro
      const monster = this.entityManager.monsters.get(monsterId);
      if (monster && monster.model) {
        monster.model.userData.isDead = true;
      }
      
      // Executar a lógica original
      this.entityManager.killMonster(monsterId);
      
      // Se o jogador local estava atacando esse monstro, parar ataque
      const localPlayer = this.entityManager.getLocalPlayer();
      if (localPlayer && localPlayer.attackTarget === monsterId) {
        localPlayer.stopAttack();
      }
      
      // Se o input manager estiver atacando este monstro, parar o auto ataque
      if (this.inputManager && this.inputManager.autoAttackTarget === monsterId) {
        console.log(`Parando auto ataque pois o monstro ${monsterId} morreu`);
        this.inputManager.stopAutoAttack();
        this.inputManager.autoAttackTarget = null;
      }
    });
    
    // Evento para quando um monstro reaparece
    this.networkManager.on('monsterRespawn', (monsterData) => {
      console.log(`Monstro ${monsterData.id} reapareceu`);
      
      // Atualizar o estado do monstro
      const monster = this.entityManager.monsters.get(monsterData.id);
      if (monster && monster.model) {
        monster.model.userData.isDead = false;
      }
      
      // Executar a lógica original
      this.entityManager.respawnMonster(monsterData.id, monsterData);
    });
  }
  
  /**
   * Inicializa os controles do jogo
   */
  initializeControls() {
    const localPlayer = this.entityManager.getLocalPlayer();
    if (!localPlayer) {
      console.error('Não foi possível inicializar controles: jogador local não encontrado');
      return;
    }
    
    // Criar gerenciador de input
    this.inputManager = new InputManager(this.renderer, this.entityManager, localPlayer);
    
    // Inicializar controles
    this.inputManager.initialize();
    
    // Adicionar callback de atualização ao loop de renderização
    this.renderer.addRenderCallback(() => {
      this.entityManager.updateEntities();
    });
  }
  
  /**
   * Mostra a tela de login
   */
  showLoginScreen() {
    // Obter informações para depuração
    const socketInfo = {
      ...this.networkManager.getDebugInfo(),
      assetsLoaded: this.resourceLoader.loadedAssets,
      assetsTotal: this.resourceLoader.totalAssets
    };
    
    // Criar tela de login
    const loginScreen = this.ui.showLoginScreen(
      // Callback de login
      (playerName, loginScreen, loginTimeout) => {
        // Enviar login
        this.networkManager.emit('login', playerName);
        
        // Verificar se o login foi bem-sucedido
        const checkGameState = () => {
          const localPlayer = this.entityManager.getLocalPlayer();
          if (localPlayer) {
            clearTimeout(loginTimeout);
            document.body.removeChild(loginScreen);
            return true;
          }
          return false;
        };
        
        // Verificar periodicamente se o login foi bem-sucedido
        const loginCheckInterval = setInterval(() => {
          if (checkGameState() || !document.body.contains(loginScreen)) {
            clearInterval(loginCheckInterval);
          }
        }, 1000);
      },
      socketInfo
    );
  }
  
  /**
   * Limpa e finaliza o jogo
   */
  cleanup() {
    // Parar animação
    if (this.renderer) {
      this.renderer.stopAnimationLoop();
    }
    
    // Remover controles
    if (this.inputManager) {
      this.inputManager.dispose();
    }
    
    // Limpar entidades
    if (this.entityManager) {
      this.entityManager.clear();
    }
    
    // Desconectar do servidor
    if (this.networkManager) {
      this.networkManager.disconnect();
    }
    
    // Limpar renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    console.log('Jogo finalizado');
  }
} 