import { UserInterface } from './ui';
import { NetworkManager } from './network';
import { ResourceLoader } from './loader';
import { GameRenderer } from '../rendering/renderer';
import { EntityManager } from '../entities/entityManager';
import { InputManager } from '../controls/inputManager';
import { initCombatSystem } from '../combat'; // Importar o sistema de combate
import { 
  VISUAL_EFFECTS, 
  MOVEMENT_CONFIG, 
  COMBAT_CONFIG, 
  NETWORK_CONFIG,
  DEBUG_CONFIG
} from './config';

/**
 * Classe principal do jogo MMORPG
 */
export class MMORPGGame {
  constructor() {
    try {
      console.log('Iniciando MMORPG Game...');
      console.time('inicialização');
      
      // Registrar o tempo de início para fins de depuração
      window.gameStartTime = Date.now();
      
      // Definições iniciais
      this.isInitialized = false;
      this.entityManager = null;
      this.inputManager = null;
      this.resourceLoader = null;
      
      // IMPORTANTE: Garantir que a instância do jogo esteja disponível globalmente
      // antes de chamar quaisquer métodos
      window.game = this;
      console.log("[Game] Instância do jogo registrada globalmente como window.game");
      
      // Armazenar referência à última instância para depuração e solução de problemas
      MMORPGGame.instance = this;
      
      // Criar componentes iniciais
      console.log("[Game] Inicializando UI...");
      this.ui = new UserInterface();
      
      // Verificar se a UI foi criada corretamente
      if (!this.ui) {
        console.error("[Game] ERRO: Falha ao inicializar UI");
        this.ui = new UserInterface(); // Tentar novamente
      }
      
      // Registrar UI globalmente para casos de emergência
      window.gameUI = this.ui;
      
      console.log("[Game] Inicializando NetworkManager...");
      this.networkManager = new NetworkManager();
      
      console.log("[Game] Inicializando GameRenderer...");
      this.renderer = new GameRenderer();
      
      // Handlers de atualização
      this.updateHandlers = new Map();
      
      // Inicializar componentes após todas as definições
      console.log("[Game] Chamando initialize()...");
      this.initialize();
    } catch (error) {
      console.error('[Game] ERRO CRÍTICO no construtor:', error);
      
      // Tentar criar uma mensagem de erro visível (sem alert)
      try {
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '10px';
        errorDiv.style.left = '10px';
        errorDiv.style.right = '10px';
        errorDiv.style.padding = '20px';
        errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.zIndex = '9999';
        errorDiv.style.whiteSpace = 'pre-wrap';
        errorDiv.textContent = `ERRO CRÍTICO na inicialização do jogo: ${error}\n\nPor favor, recarregue a página.`;
        document.body.appendChild(errorDiv);
      } catch (e) {
        console.error('Erro crítico ao inicializar o jogo. Verifique o console e recarregue a página.', e);
      }
    }
  }
  
  // Método estático para acessar a última instância do jogo
  static getInstance() {
    return MMORPGGame.instance;
  }
  
  /**
   * Inicializa o jogo
   */
  initialize() {
    try {
      console.log('Inicializando jogo...');
      
      // Inicializar configuração de debug
      this.DEBUG_CONFIG = Object.assign({}, DEBUG_CONFIG);
      window.game = this;
      
      console.log('[Game] Inicializando componentes do jogo...');
      
      // Verificar se o renderer existe
      if (!this.renderer) {
        console.error('[Game] Renderer não existe, criando...');
        this.renderer = new GameRenderer();
      }
      
      // Inicializar renderer
      console.log('[Game] Inicializando renderer...');
      const rendererResult = this.renderer.initialize();
      
      if (!rendererResult || !rendererResult.scene) {
        throw new Error('Falha ao inicializar o renderer: scene não disponível');
      }
      
      const { scene } = rendererResult;
      
      // Criar gerenciador de entidades
      console.log('[Game] Criando gerenciador de entidades...');
      this.entityManager = new EntityManager(scene, this.networkManager, this.renderer);
      
      // Configurar gerenciador de input (será configurado após o login)
      this.inputManager = null;
      
      // Verificar se a UI existe
      if (!this.ui) {
        console.error('[Game] UI não existe, criando...');
        this.ui = new UserInterface();
        window.gameUI = this.ui;
      }
      
      // Criar carregador de recursos com tratamento de erros
      console.log('[Game] Criando ResourceLoader...');
      this.resourceLoader = new ResourceLoader(
        // Callback de progresso com verificação de segurança
        (progress) => {
          try {
            if (this.ui) {
              this.ui.updateLoadingProgress(progress * 0.3); // 30% do progresso total
            } else {
              console.error('[Game] UI não disponível para atualizar progresso');
            }
          } catch (error) {
            console.error('[Game] Erro ao atualizar progresso de carregamento:', error);
          }
        },
        // Callback de conclusão
        (resources) => {
          console.log('Recursos carregados:', resources);
          this.connect();
        }
      );
      
      // Iniciar carregamento de recursos
      console.log('[Game] Iniciando carregamento de recursos...');
      this.preloadResources();
      
      console.log('[Game] Inicialização concluída com sucesso.');
    } catch (error) {
      console.error('[Game] ERRO CRÍTICO na inicialização:', error);
      
      // Tentar mostrar erro na UI
      if (this.ui) {
        try {
          this.ui.showErrorMessage('Erro crítico na inicialização: ' + error.message);
        } catch (e) {
          console.error('[Game] Falha ao mostrar erro na UI:', e);
        }
      }
      
      // Backup: mostrar erro visível
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'fixed';
      errorDiv.style.top = '50%';
      errorDiv.style.left = '50%';
      errorDiv.style.transform = 'translate(-50%, -50%)';
      errorDiv.style.padding = '20px';
      errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      errorDiv.style.color = 'white';
      errorDiv.style.borderRadius = '5px';
      errorDiv.style.zIndex = '9999';
      errorDiv.textContent = 'Erro crítico na inicialização: ' + error.message;
      document.body.appendChild(errorDiv);
    }
  }
  
  /**
   * Pré-carrega recursos essenciais
   */
  preloadResources() {
    try {
      // Verificar se a UI existe
      if (!this.ui) {
        console.error('[Game] ERRO CRÍTICO: UI não inicializada. Recriando...');
        this.ui = new UserInterface();
        window.gameUI = this.ui; // Referência de emergência
      }
      
      // Atualizar progresso inicial com verificação de segurança
      try {
        console.log('[Game] Atualizando progresso de carregamento: 5%');
        this.ui.updateLoadingProgress(0.05);
      } catch (error) {
        console.error('[Game] Erro ao atualizar progresso:', error);
      }
      
      // Verificar se resourceLoader existe
      if (!this.resourceLoader) {
        console.error('[Game] ResourceLoader não inicializado. Inicializando...');
        this.resourceLoader = new ResourceLoader(
          // Callback de progresso com tratamento de erro adicional
          (progress) => {
            try {
              console.log(`[Game] Progresso de carregamento: ${(progress * 30).toFixed(0)}%`);
              if (this.ui) this.ui.updateLoadingProgress(progress * 0.3);
            } catch (err) {
              console.error('[Game] Erro ao atualizar progresso de recursos:', err);
            }
          },
          // Callback de conclusão
          (resources) => {
            console.log('[Game] Recursos carregados:', resources);
            this.connect();
          }
        );
      }
      
      // Pré-carregar recursos críticos com tratamento de erro melhorado
      console.log('[Game] Iniciando carregamento de recursos críticos...');
      this.resourceLoader.preloadCriticalResources()
        .then(() => {
          console.log('[Game] Recursos críticos carregados. Carregando modelos...');
          // Carregar todos os modelos
          return this.resourceLoader.loadAllModels();
        })
        .catch(error => {
          console.error('[Game] Erro ao carregar recursos:', error);
          
          // Tentar recuperar da falha
          if (this.ui) {
            this.ui.showErrorMessage('Erro ao carregar recursos necessários. Por favor, recarregue a página.');
          } else {
            // Criar mensagem de erro manual se a UI falhou
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '50%';
            errorDiv.style.left = '50%';
            errorDiv.style.transform = 'translate(-50%, -50%)';
            errorDiv.style.padding = '20px';
            errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            errorDiv.style.color = 'white';
            errorDiv.style.borderRadius = '5px';
            errorDiv.style.zIndex = '9999';
            errorDiv.textContent = 'Erro crítico ao carregar recursos. Por favor, recarregue a página.';
            document.body.appendChild(errorDiv);
          }
        });
    } catch (error) {
      console.error('[Game] Erro crítico ao pré-carregar recursos:', error);
      
      // Mostrar mensagem sem alert
      try {
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.padding = '20px';
        errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.zIndex = '9999';
        errorDiv.textContent = 'Erro crítico ao inicializar o jogo. Por favor, recarregue a página.';
        document.body.appendChild(errorDiv);
        
        // Oferecer botão para recarregar
        const reloadButton = document.createElement('button');
        reloadButton.textContent = 'Recarregar Página';
        reloadButton.style.marginTop = '10px';
        reloadButton.style.padding = '5px 10px';
        reloadButton.style.cursor = 'pointer';
        reloadButton.onclick = () => window.location.reload();
        errorDiv.appendChild(reloadButton);
      } catch (e) {
        console.error('Não foi possível mostrar mensagem de erro', e);
      }
    }
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
      console.log('[Game] Estado do jogo recebido:', data);
      
      // Verificar se os dados são válidos
      if (!data || !data.selfId) {
        console.error('[Game] Dados do gameState inválidos:', data);
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
        
        // Iniciar o jogo após receber o estado
        this.startGame(data.players[data.selfId]);
        
      } catch (error) {
        console.error('[Game] Erro ao processar o estado do jogo:', error);
      }
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
    
    // Evento para quando um monstro é danificado
    this.networkManager.on('monsterDamaged', (data) => {
      console.log(`[Game] Evento monsterDamaged recebido: Monstro ${data.id} recebeu ${data.damage} de dano de ${data.attackerId}. HP restante: ${data.hp}`);
      
      // Atualizar HP do monstro
      const monster = this.entityManager.monsters.get(data.id);
      if (!monster) {
        console.log(`[Game] Erro: Monstro ${data.id} não encontrado no evento monsterDamaged`);
        return;
      }
      
      // Interromper qualquer movimento imediatamente
      if (monster.isMoving) {
        console.log(`[Game] Interrompendo movimento do monstro ${data.id}`);
        monster.stopMovement();
      }
      
      // Verificar se este evento já foi processado localmente
      const processLocally = monster.hp !== data.hp;
      
      if (processLocally) {
        console.log(`[Game] Processando evento monsterDamaged do servidor. HP local: ${monster.hp}, HP servidor: ${data.hp}`);
        
        // Sincronizar HP com o servidor
        monster.hp = data.hp;
        monster.data.hp = data.hp;
        
        // Se estamos usando o sistema de combate
        if (monster.combatStats) {
          monster.combatStats.hp = data.hp;
          monster.isDead = monster.combatStats.isDead = (data.hp <= 0);
        } else {
          monster.isDead = (data.hp <= 0);
        }
        
        // Atualizar nome com novo HP
        monster.updateNameDisplay();
        
        // Efeito visual de dano (no caso de não ter sido processado localmente)
        monster.showDamageEffect(data.damage);
      }
      
      // Sempre aplicar a lógica de agressividade, mesmo se já foi processado localmente
      // para garantir que o monstro fique agressivo
      if (data.attackerId && monster.ai) {
        console.log(`[Game] Forçando agressividade do monstro ${data.id} contra ${data.attackerId}`);
        
        // Definir jogador como alvo
        monster.ai.setAggroTarget(data.attackerId);
        
        // Forçar mudança de estado para agressivo e perseguição imediata
        monster.ai.setState('aggro');
        
        // Atualizar IA imediatamente (não esperar o próximo frame)
        setTimeout(() => {
          if (monster.ai && !monster.isDead) {
            monster.ai.pursueTarget();
          }
        }, 100);
      }
      
      // Verificar se o monstro morreu
      if (data.hp <= 0 && !monster.isDead) {
        console.log(`[Game] Monstro ${data.id} morreu pelo evento do servidor`);
        monster.die();
      }
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
      
      // Se the input manager estiver atacando este monstro, parar o auto ataque
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
    
    // Evento para quando um monstro se move
    this.networkManager.on('monsterMoved', (data) => {
      console.log(`Monstro ${data.id} moveu para`, data.position);
      const monster = this.entityManager.monsters.get(data.id);
      if (monster) {
        monster.updatePosition(data.position);
      }
    });
    
    // Evento para quando um monstro ataca um jogador
    this.networkManager.on('monsterAttack', (data) => {
      console.log(`Monstro ${data.monsterId} atacou jogador ${data.targetId}`);
      
      // Buscar jogador e aplicar dano
      const player = this.entityManager.players.get(data.targetId);
      if (player) {
        player.takeDamage(data.damage, data.monsterId);
      }
    });
    
    // Evento para quando um jogador morre
    this.networkManager.on('playerDied', (data) => {
      console.log(`Jogador ${data.playerId} morreu`);
      
      // Buscar jogador e processar morte
      const player = this.entityManager.players.get(data.playerId);
      if (player && !player.isDead) {
        player.die();
      }
    });
    
    // Evento para quando um jogador respawna
    this.networkManager.on('playerRespawn', (data) => {
      console.log(`Jogador ${data.playerId} respawnou`);
      
      // Buscar jogador e processar respawn
      const player = this.entityManager.players.get(data.playerId);
      if (player && player.isDead) {
        player.respawn();
      }
    });
    
    // Evento para quando um jogador ataca
    this.networkManager.on('playerAttack', (data) => {
      console.log(`Jogador ${data.attackerId} atacou ${data.targetId}`);
      
      // Verificar se o alvo é um monstro
      if (data.targetId.startsWith('monster')) {
        const monster = this.entityManager.monsters.get(data.targetId);
        if (monster) {
          // Calcular dano baseado no jogador e no tipo de monstro (pode ser melhorado)
          const damage = Math.floor(Math.random() * 10) + 5;
          
          // Aplicar dano ao monstro, passando o ID do atacante
          monster.takeDamage(damage, data.attackerId);
        }
      }
    });
    
    // Evento para resultados de ataque
    this.networkManager.on('attackResult', (data) => {
      if (data.success) {
        console.log(`Ataque bem-sucedido contra ${data.targetId} causando ${data.damage} de dano`);
        
        // Mostrar feedback visual se necessário
        // Por exemplo, números de dano flutuantes
      } else {
        console.log(`Ataque falhou contra ${data.targetId}: ${data.error}`);
      }
    });
    
    // Evento para atualização de jogador
    this.networkManager.on('playerUpdated', (data) => {
      console.log(`[Game] Jogador ${data.id} atualizado:`, data);
      
      // Atualizar jogador
      const player = this.entityManager.createOrUpdatePlayer(data.id, data);
      
      // Se for o jogador local, atualizar a UI
      if (data.id === this.entityManager.localPlayerId) {
        this.updatePlayerUI(player);
      }
    });
    
    // Evento para quando um jogador recebe dano
    this.networkManager.on('playerDamaged', (data) => {
      console.log(`[Game] Jogador ${data.id} recebeu ${data.damage} de dano de ${data.attackerId}`);
      
      // Verificar se é o jogador local
      const isLocalPlayer = this.entityManager.localPlayerId === data.id;
      
      // Buscar o jogador e atualizar HP (sem recalcular o dano)
      const player = this.entityManager.players.get(data.id);
      if (!player) {
        console.error(`[Game] Jogador ${data.id} não encontrado para processar dano`);
        return;
      }
      
      // Verificar se é o jogador local ou não
      if (isLocalPlayer) {
        // Para o jogador local, atualizamos as estatísticas diretamente
        // sem chamar takeDamage novamente (evita duplicação)
        
        // Atualizar HP do jogador
        if (player.combatStats) {
          player.combatStats.hp = Math.max(0, Number(data.hp) || 0);
          player.hp = player.combatStats.hp;
        } else {
          player.hp = Math.max(0, Number(data.hp) || 0);
        }
        
        // Atualizar dados
        if (player.data) {
          player.data.hp = player.hp;
        }
        
        // Verificar se o jogador morreu
        if (player.hp <= 0 && !player.isDead) {
          player.isDead = true;
          if (typeof player.die === 'function') player.die();
        }
        
        // Mostrar efeito visual de dano
        player.showDamageEffect(data.damage);
        
        // Atualizar UI
        this.updatePlayerUI(player);
      } else {
        // Para outros jogadores, podemos chamar takeDamage
        if (player.takeDamage) {
          player.takeDamage(data.damage, data.attackerId);
        }
      }
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
   * Inicializa o jogo após o login
   * @param {Object} playerData - Dados do jogador
   */
  startGame(playerData) {
    try {
      console.log('[Game] Iniciando jogo com playerData:', playerData);
      
      // Verificar se já temos o jogador local
      let localPlayer = this.entityManager.getLocalPlayer();
      
      // Se não tiver, criar o jogador local
      if (!localPlayer) {
        localPlayer = this.entityManager.createLocalPlayer(playerData);
      }
      
      if (!localPlayer) {
        console.error('[Game] Erro ao iniciar jogo: jogador local não encontrado');
        return;
      }
      
      // Criar o terreno
      console.log('[Game] Criando terreno...');
      this.renderer.createGround();
      
      // Inicializar controles
      this.initializeControls();
      
      // Inicializar sistema de combate
      try {
        this.combatSystem = initCombatSystem(this);
        console.log('[Game] Sistema de combate inicializado');
      } catch (error) {
        console.error('[Game] Erro ao inicializar sistema de combate:', error);
        // Criar um sistema de combate vazio para evitar erros
        this.combatSystem = {
          setupEntity: () => {},
          processAttack: () => ({ success: false, message: 'Sistema de combate não disponível' }),
          update: () => {},
          onAttack: () => {},
          onDamage: () => {},
          onDeath: () => {},
          onHeal: () => {}
        };
      }
      
      // Registrar sistema de combate no gerenciador de entidades
      if (this.entityManager) {
        this.entityManager.setCombatSystem(this.combatSystem);
      }
      
      // Adicionar referência do entityManager a todos os monstros existentes
      for (const [monsterId, monster] of this.entityManager.monsters.entries()) {
        if (monster && monster.ai) {
          monster.ai.entityManager = this.entityManager;
          console.log(`[Game] EntityManager configurado para monstro ${monsterId}`);
        }
      }
      
      // Iniciar loop de renderização
      this.renderer.startAnimationLoop((deltaTime) => {
        // Executar atualizadores registrados
        for (const [name, handler] of this.updateHandlers.entries()) {
          try {
            handler(deltaTime);
          } catch (error) {
            console.error(`Erro no handler de atualização "${name}":`, error);
          }
        }
      });
      
      // Tentar configurar handlers específicos de combate
      try {
        this._setupCombatHandlers();
      } catch (error) {
        console.error('[Game] Erro ao configurar handlers de combate:', error);
      }
      
      // Mostrar interface de jogo
      this.ui.showGameUI();
      
      // Atualizar UI com dados do jogador
      this.updatePlayerUI(localPlayer);
      
      // Ocultar tela de carregamento
      this.ui.hideLoading();
      
      // Registrar o jogo como globalmente acessível para depuração
      window.game = this;
      
      console.timeEnd('inicialização');
      console.log('[Game] Jogo iniciado!');
    } catch (error) {
      console.error('[Game] Erro ao iniciar jogo:', error);
      this.ui.showErrorMessage('Erro ao iniciar o jogo. Por favor, recarregue a página.');
    }
  }
  
  /**
   * Atualiza a UI com dados do jogador
   * @param {Object} player - Jogador local
   */
  updatePlayerUI(player) {
    if (!player) {
      console.error('[Game] Não foi possível atualizar UI: jogador não fornecido');
      return;
    }
    
    // Extrair valores de HP e MP e garantir que sejam numéricos
    let hp = player.combatStats ? player.combatStats.hp : player.hp;
    let maxHp = player.combatStats ? player.combatStats.maxHp : player.maxHp;
    let mp = player.combatStats ? player.combatStats.mp : player.mp;
    let maxMp = player.combatStats ? player.combatStats.maxMp : player.maxMp;
    
    // Garantir valores numéricos válidos
    hp = Number(hp) || 0;
    maxHp = Number(maxHp) || 100;
    mp = Number(mp) || 0;
    maxMp = Number(maxMp) || 50;
    
    // Garantir que o HP não seja maior que o maxHP
    hp = Math.min(hp, maxHp);
    mp = Math.min(mp, maxMp);
    
    // Dados para a UI
    const playerUIData = {
      name: player.name || player.id || 'Jogador',
      hp: hp,
      maxHp: maxHp,
      mp: mp,
      maxMp: maxMp
    };
    
    // Log para debug
    console.log(`[Game] Atualizando UI: HP=${hp}/${maxHp}, MP=${mp}/${maxMp}`);
    
    // Atualizar HUD
    this.ui.updatePlayerInfo(playerUIData, player.data?.class || 'Guerreiro');
    
    // Programar próxima atualização periódica (a cada 1 segundo)
    setTimeout(() => this.updatePlayerUI(player), 1000);
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
  
  /**
   * Configura handlers específicos do sistema de combate
   * @private
   */
  _setupCombatHandlers() {
    if (!this.combatSystem) {
      console.warn('[Game] Sistema de combate não disponível, não é possível configurar handlers');
      return;
    }
    
    // Ouvir eventos de dano
    this.combatSystem.onDamage((entity, amount, type, attackerId, options) => {
      console.log(`[CombatHandler] Entidade ${entity.id} recebeu ${amount} de dano do tipo ${type}`);
      
      // Atualizar interface com feedback visual
      if (this.ui.showDamageNumber) {
        this.ui.showDamageNumber(entity, amount, type, options);
      }
      
      // Notificar servidor sobre o dano (se for atacante local)
      if (attackerId === this.entityManager.localPlayerId) {
        this.networkManager.emit('playerAttackResult', {
          attackerId: attackerId,
          targetId: entity.id,
          damage: amount,
          type: type,
          critical: options && options.critical || false
        });
      }
    });
    
    // Ouvir eventos de morte
    this.combatSystem.onDeath((entity) => {
      console.log(`[CombatHandler] Entidade ${entity.id} morreu`);
      
      // Atualizar interface com feedback visual
      if (this.ui.showDeathEffect) {
        this.ui.showDeathEffect(entity);
      }
      
      // Processar recompensas se for monstro
      if (entity.type === 'monster') {
        // Calcular e distribuir recompensas
        this._processMobKillRewards(entity);
      }
    });
    
    // Ouvir eventos de ataque
    this.combatSystem.onAttack((attacker, target, details) => {
      console.log(`[CombatHandler] ${attacker.id} atacou ${target.id} (dano: ${details.damage})`);
      
      // Efeitos visuais de ataque
      if (this.renderer && this.renderer.showAttackEffect) {
        this.renderer.showAttackEffect(attacker, target, details);
      }
    });
    
    console.log('[Game] Handlers de combate configurados com sucesso');
  }
  
  /**
   * Processa recompensas por eliminar um monstro
   * @param {Object} monster - Monstro eliminado
   * @private
   */
  _processMobKillRewards(monster) {
    // Verificar quem deve receber recompensas (quem causou mais dano)
    const killer = this.entityManager.getLocalPlayer(); // Simplificado para este exemplo
    
    if (killer) {
      // Calcular experiência com base no nível do monstro
      const monsterLevel = monster.combatStats ? monster.combatStats.level : 1;
      const expReward = 10 * monsterLevel;
      
      // Distribuir recompensas (simplificado)
      this.ui.showMessage(`Você ganhou ${expReward} pontos de experiência!`);
      
      // Notificar servidor
      this.networkManager.emit('monsterKilled', {
        monsterId: monster.id,
        killerId: killer.id
      });
    }
  }
  
  // Adicionar um método para ajustar as configurações de debug
  toggleDebugOption(option, value) {
    if (!this.DEBUG_CONFIG) return;
    
    if (option === 'all') {
      this.DEBUG_CONFIG.enabled = value;
      console.log(`Debug ${value ? 'ativado' : 'desativado'}`);
      return;
    }
    
    if (this.DEBUG_CONFIG.hasOwnProperty(option)) {
      this.DEBUG_CONFIG[option] = value;
      console.log(`Debug ${option} ${value ? 'ativado' : 'desativado'}`);
    }
  }
} 