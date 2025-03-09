import * as THREE from 'three';
import { createElement } from '../utils/helpers';

/**
 * Classe para gerenciar a interface do usuário do jogo
 */
export class UserInterface {
  constructor() {
    this.loadingElement = null;
    this.progressBarElement = null;
    this.progressTextElement = null;
    this.hudElement = null;
    this.inventoryElement = null;
    this.shortcutTipElement = null;
    
    this.elements = {
      loadingScreen: null,
      progressBar: null,
      progressText: null,
      hud: null,
      playerName: null,
      playerClass: null,
      hpBar: null,
      mpBar: null,
      hpText: null,
      mpText: null,
      controlsInfo: null
    };
    
    // Inicializar elementos da UI
    this.checkElements();
  }
  
  /**
   * Verifica se os elementos da UI existem e os cria se necessário
   */
  checkElements() {
    // Tela de carregamento
    if (!this.elements.loadingScreen) {
      this.elements.loadingScreen = document.getElementById('loading');
      this.elements.progressBar = document.getElementById('loading-progress');
      this.elements.progressText = document.getElementById('loading-text');
    }
    
    // HUD e elementos de jogador
    if (!this.elements.hud) {
      this.elements.hud = document.getElementById('hud');
      
      if (this.elements.hud) {
        // Buscar elementos dentro do HUD
        this.elements.playerName = document.getElementById('player-name');
        this.elements.playerClass = document.getElementById('player-class');
        this.elements.playerHp = document.getElementById('player-hp');
        this.elements.playerMaxHp = document.getElementById('player-max-hp');
        
        // Adicionar barras de HP/MP se não existirem
        if (!document.getElementById('hp-bar')) {
          const hpBarContainer = createElement('div', {
            width: '100%',
            height: '10px',
            backgroundColor: '#333',
            marginTop: '5px',
            borderRadius: '5px',
            overflow: 'hidden'
          }, { id: 'hp-bar-container' }, '', this.elements.hud);
          
          this.elements.hpBar = createElement('div', {
            width: '100%',
            height: '100%',
            backgroundColor: '#e53935',
            transition: 'width 0.3s'
          }, { id: 'hp-bar' }, '', hpBarContainer);
        } else {
          this.elements.hpBar = document.getElementById('hp-bar');
        }
        
        if (!document.getElementById('mp-bar')) {
          const mpBarContainer = createElement('div', {
            width: '100%',
            height: '10px',
            backgroundColor: '#333',
            marginTop: '5px',
            borderRadius: '5px',
            overflow: 'hidden'
          }, { id: 'mp-bar-container' }, '', this.elements.hud);
          
          this.elements.mpBar = createElement('div', {
            width: '100%',
            height: '100%',
            backgroundColor: '#2196F3',
            transition: 'width 0.3s'
          }, { id: 'mp-bar' }, '', mpBarContainer);
        } else {
          this.elements.mpBar = document.getElementById('mp-bar');
        }      
      }
    }
    
    // Informações de controles
    if (!this.elements.controlsInfo) {
      this.elements.controlsInfo = document.getElementById('controls-info');
    }
  }
  
  /**
   * Atualiza a barra de progresso de carregamento
   * @param {number} increment - Incremento ao progresso (de 0 a 1)
   */
  updateLoadingProgress(increment) {
    // Garantir que os elementos existam
    this.checkElements();
    
    if (!this.elements.progressBar) {
      console.error("[UI] Erro: progressBar não encontrado");
      // Tentar recuperar ou criar elementos
      this.createLoadingElements();
      // Verificar novamente
      if (!this.elements.progressBar) {
        console.warn("[UI] Não foi possível atualizar o progresso. Element não encontrado.");
        return;
      }
    }
    
    try {
      // Obter largura atual e calcular nova largura
      const currentWidth = parseFloat(this.elements.progressBar.style.width || '0');
      const newWidth = Math.min(currentWidth + increment * 100, 100);
      
      // Atualizar barra de progresso
      this.elements.progressBar.style.width = `${newWidth}%`;
      
      // Atualizar texto de carregamento
      if (this.elements.progressText) {
        if (newWidth < 20) {
          this.elements.progressText.textContent = 'Conectando ao servidor...';
        } else if (newWidth < 50) {
          this.elements.progressText.textContent = 'Carregando modelos...';
        } else if (newWidth < 80) {
          this.elements.progressText.textContent = 'Preparando mundo do jogo...';
        } else if (newWidth < 100) {
          this.elements.progressText.textContent = 'Quase pronto...';
        } else {
          this.elements.progressText.textContent = 'Pronto!';
        }
      }
      
      // Se completou o carregamento
      if (newWidth >= 100) {
        setTimeout(() => {
          this.hideLoading();
          this.showGameUI();
        }, 500);
      }
    } catch (error) {
      console.error("[UI] Erro ao atualizar progresso:", error);
    }
  }
  
  /**
   * Cria elementos de carregamento se eles não existirem
   * @private
   */
  createLoadingElements() {
    console.log("[UI] Tentando criar elementos de carregamento");
    
    // Verificar se já existe uma tela de carregamento
    let loadingScreen = document.getElementById('loading');
    
    if (!loadingScreen) {
      // Criar tela de carregamento
      loadingScreen = document.createElement('div');
      loadingScreen.id = 'loading';
      loadingScreen.style.position = 'fixed';
      loadingScreen.style.top = '0';
      loadingScreen.style.left = '0';
      loadingScreen.style.width = '100%';
      loadingScreen.style.height = '100%';
      loadingScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
      loadingScreen.style.display = 'flex';
      loadingScreen.style.flexDirection = 'column';
      loadingScreen.style.justifyContent = 'center';
      loadingScreen.style.alignItems = 'center';
      loadingScreen.style.zIndex = '1000';
      document.body.appendChild(loadingScreen);
      
      // Título
      const title = document.createElement('h1');
      title.textContent = 'MMORPG Game';
      title.style.color = 'white';
      title.style.marginBottom = '20px';
      loadingScreen.appendChild(title);
      
      // Container da barra de progresso
      const progressContainer = document.createElement('div');
      progressContainer.style.width = '80%';
      progressContainer.style.height = '20px';
      progressContainer.style.backgroundColor = '#333';
      progressContainer.style.borderRadius = '10px';
      progressContainer.style.overflow = 'hidden';
      loadingScreen.appendChild(progressContainer);
      
      // Barra de progresso
      const progressBar = document.createElement('div');
      progressBar.id = 'loading-progress';
      progressBar.style.width = '0%';
      progressBar.style.height = '100%';
      progressBar.style.backgroundColor = '#4CAF50';
      progressBar.style.transition = 'width 0.3s';
      progressContainer.appendChild(progressBar);
      
      // Texto de carregamento
      const progressText = document.createElement('div');
      progressText.id = 'loading-text';
      progressText.textContent = 'Iniciando...';
      progressText.style.color = 'white';
      progressText.style.marginTop = '10px';
      loadingScreen.appendChild(progressText);
      
      // Atualizar referências
      this.elements.loadingScreen = loadingScreen;
      this.elements.progressBar = progressBar;
      this.elements.progressText = progressText;
      
      console.log("[UI] Elementos de carregamento criados com sucesso");
    } else {
      // Se a tela já existe, apenas atualizar referências
      this.elements.loadingScreen = loadingScreen;
      this.elements.progressBar = document.getElementById('loading-progress');
      this.elements.progressText = document.getElementById('loading-text');
      
      console.log("[UI] Referências de elementos de carregamento atualizadas");
    }
  }
  
  /**
   * Oculta a tela de carregamento
   */
  hideLoading() {
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.style.display = 'none';
    }
  }
  
  /**
   * Mostra a interface do jogo
   */
  showGameUI() {
    if (this.elements.hud) {
      this.elements.hud.style.display = 'block';
    }
    if (this.elements.controlsInfo) {
      this.elements.controlsInfo.style.display = 'block';
    }
    
    // Verificar se os elementos já existem
    this.checkElements();
    
    // Adicionar inventário
    if (!this.inventoryElement) {
      this.inventoryElement = createElement('div', {
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        padding: '5px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: '3px',
        border: '1px solid #444'
      }, { id: 'game-inventory' }, 'Inventário (em desenvolvimento)', document.body);
    }
    
    // Adicionar dica sobre tecla de atalho para configurações
    if (!this.shortcutTipElement) {
      this.shortcutTipElement = createElement('div', {
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '5px 10px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        borderRadius: '3px',
        fontSize: '12px',
        border: '1px solid #555',
        transition: 'opacity 0.5s ease-in-out'
      }, { id: 'shortcut-tip' }, 'Pressione [O] para configurações', document.body);
      
      // Fazer a dica desaparecer após 10 segundos
      setTimeout(() => {
        if (this.shortcutTipElement) {
          this.shortcutTipElement.style.opacity = '0';
          
          // Remover do DOM após a transição
          setTimeout(() => {
            if (this.shortcutTipElement && this.shortcutTipElement.parentNode) {
              this.shortcutTipElement.parentNode.removeChild(this.shortcutTipElement);
              this.shortcutTipElement = null;
            }
          }, 500);
        }
      }, 10000);
    }
    
    // Adicionar painel de debug
    this.createDebugPanel();
  }
  
  /**
   * Atualiza as informações do jogador na interface
   * @param {Object} player - Objeto do jogador
   * @param {string} className - Nome da classe do jogador
   */
  updatePlayerInfo(player, className) {
    // Verificar se temos os elementos necessários
    const nameElement = document.getElementById('player-name');
    const classElement = document.getElementById('player-class');
    const hpElement = document.getElementById('player-hp');
    const maxHpElement = document.getElementById('player-max-hp');
    
    // Verificar o elemento de MP
    let mpElement = document.getElementById('player-mp');
    let maxMpElement = document.getElementById('player-max-mp');
    
    // Atualizar nome e classe
    if (nameElement) nameElement.textContent = player.name || 'Desconhecido';
    if (classElement) classElement.textContent = className || 'Guerreiro';
    
    // Obter HP e MP do jogador com valores seguros
    const hp = player.combatStats?.hp || player.hp || 0;
    const maxHp = player.combatStats?.maxHp || player.maxHp || 100;
    const mp = player.combatStats?.mp || player.mp || 0;
    const maxMp = player.combatStats?.maxMp || player.maxMp || 100;
    
    // Garantir que são valores numéricos
    const safeHp = Number(hp) || 0;
    const safeMaxHp = Number(maxHp) || 100;
    const safeMp = Number(mp) || 0;
    const safeMaxMp = Number(maxMp) || 100;
    
    // Debug para rastrear valores
    console.log(`[UI.updatePlayerInfo] Atualizando UI: HP=${safeHp}/${safeMaxHp}, MP=${safeMp}/${safeMaxMp}`);
    
    // Atualizar HP
    if (hpElement) hpElement.textContent = Math.floor(safeHp);
    if (maxHpElement) maxHpElement.textContent = Math.floor(safeMaxHp);
    
    // Atualizar MP
    if (mpElement) mpElement.textContent = Math.floor(safeMp);
    if (maxMpElement) maxMpElement.textContent = Math.floor(safeMaxMp);
    
    // Atualizar barras de progresso se existirem
    this.updateProgressBars(safeHp / safeMaxHp, safeMp / safeMaxMp);
  }
  
  /**
   * Atualiza as barras de progresso de HP e MP
   * @param {number} hpPercent - Porcentagem de HP (0-1)
   * @param {number} mpPercent - Porcentagem de MP (0-1)
   */
  updateProgressBars(hpPercent, mpPercent) {
    // Verificar se as barras de progresso existem
    let hpBar = document.getElementById('hp-bar');
    let mpBar = document.getElementById('mp-bar');
    
    // Criar barras se não existirem
    if (!hpBar || !mpBar) {
      const hud = document.getElementById('hud');
      if (hud) {
        // Adicionar estilos ao hud para barras de progresso
        const statBarsContainer = document.createElement('div');
        statBarsContainer.id = 'stat-bars';
        statBarsContainer.style.marginTop = '10px';
        
        // Criar barra de HP
        const hpBarContainer = document.createElement('div');
        hpBarContainer.style.width = '100%';
        hpBarContainer.style.height = '15px';
        hpBarContainer.style.backgroundColor = '#444';
        hpBarContainer.style.borderRadius = '3px';
        hpBarContainer.style.marginBottom = '5px';
        hpBarContainer.style.position = 'relative';
        
        hpBar = document.createElement('div');
        hpBar.id = 'hp-bar';
        hpBar.style.width = `${hpPercent * 100}%`;
        hpBar.style.height = '100%';
        hpBar.style.backgroundColor = '#e74c3c';
        hpBar.style.borderRadius = '3px';
        hpBar.style.transition = 'width 0.3s';
        
        const hpLabel = document.createElement('div');
        hpLabel.textContent = 'HP';
        hpLabel.style.position = 'absolute';
        hpLabel.style.left = '5px';
        hpLabel.style.top = '0';
        hpLabel.style.fontSize = '10px';
        hpLabel.style.color = 'white';
        
        hpBarContainer.appendChild(hpBar);
        hpBarContainer.appendChild(hpLabel);
        
        // Criar barra de MP
        const mpBarContainer = document.createElement('div');
        mpBarContainer.style.width = '100%';
        mpBarContainer.style.height = '15px';
        mpBarContainer.style.backgroundColor = '#444';
        mpBarContainer.style.borderRadius = '3px';
        mpBarContainer.style.position = 'relative';
        
        mpBar = document.createElement('div');
        mpBar.id = 'mp-bar';
        mpBar.style.width = `${mpPercent * 100}%`;
        mpBar.style.height = '100%';
        mpBar.style.backgroundColor = '#3498db';
        mpBar.style.borderRadius = '3px';
        mpBar.style.transition = 'width 0.3s';
        
        const mpLabel = document.createElement('div');
        mpLabel.textContent = 'MP';
        mpLabel.style.position = 'absolute';
        mpLabel.style.left = '5px';
        mpLabel.style.top = '0';
        mpLabel.style.fontSize = '10px';
        mpLabel.style.color = 'white';
        
        mpBarContainer.appendChild(mpBar);
        mpBarContainer.appendChild(mpLabel);
        
        // Adicionar barras ao container
        statBarsContainer.appendChild(hpBarContainer);
        statBarsContainer.appendChild(mpBarContainer);
        
        // Adicionar ao HUD
        hud.appendChild(statBarsContainer);
      }
    } else {
      // Atualizar valores das barras existentes
      hpBar.style.width = `${Math.max(0, Math.min(100, hpPercent * 100))}%`;
      mpBar.style.width = `${Math.max(0, Math.min(100, mpPercent * 100))}%`;
    }
  }
  
  /**
   * Mostra uma mensagem de erro
   * @param {string} message - Mensagem de erro
   */
  showErrorMessage(message) {
    const errorDiv = createElement('div', {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(255, 0, 0, 0.8)',
      color: 'white',
      padding: '20px',
      borderRadius: '5px',
      fontSize: '16px',
      textAlign: 'center',
      zIndex: '2000'
    }, {}, message, document.body);
    
    const reloadButton = createElement('button', {
      marginTop: '10px',
      padding: '5px 10px',
      backgroundColor: 'white',
      color: 'black',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer'
    }, {}, 'Recarregar', errorDiv);
    
    errorDiv.appendChild(document.createElement('br'));
    
    reloadButton.addEventListener('click', () => {
      window.location.reload();
    });
  }
  
  /**
   * Cria e mostra a tela de login
   * @param {Function} onLogin - Callback chamado quando o login for enviado
   * @param {Object} socketInfo - Informações do socket para depuração
   */
  showLoginScreen(onLogin, socketInfo) {
    const loginScreen = createElement('div', {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
    }, { id: 'login-screen' }, null, document.body);
    
    const title = createElement('h1', {
      color: 'white',
      marginBottom: '20px'
    }, {}, 'MMORPG Estilo Ragnarok', loginScreen);
    
    const input = createElement('input', {
      padding: '10px',
      marginBottom: '10px',
      width: '300px'
    }, { type: 'text', placeholder: 'Digite seu nome de usuário' }, null, loginScreen);
    
    const statusMessage = createElement('div', {
      color: 'white',
      marginBottom: '10px',
      fontSize: '14px',
      height: '20px'
    }, {}, '', loginScreen);
    
    const button = createElement('button', {
      padding: '10px 20px',
      backgroundColor: '#4CAF50',
      color: 'white',
      border: 'none',
      cursor: 'pointer'
    }, {}, 'Entrar no Jogo', loginScreen);
    
    // Adicionar botão de debug
    const debugButton = createElement('button', {
      padding: '5px 10px',
      backgroundColor: '#555',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      marginTop: '15px',
      fontSize: '12px'
    }, {}, 'Mostrar Detalhes Técnicos', loginScreen);
    
    const debugInfo = createElement('div', {
      color: '#aaa',
      fontSize: '12px',
      marginTop: '20px',
      display: 'none'
    }, {}, 'Pressione F12 para ver mais detalhes no console.', loginScreen);
    
    debugButton.addEventListener('click', () => {
      if (debugInfo.style.display === 'none') {
        debugInfo.style.display = 'block';
        debugInfo.innerHTML = `
          Status da Conexão: ${socketInfo.connected ? 'Conectado' : 'Desconectado'}<br>
          ID da Conexão: ${socketInfo.id || 'N/A'}<br>
          Modelos Carregados: ${socketInfo.assetsLoaded}/${socketInfo.assetsTotal}<br>
          URL do Servidor: ${socketInfo.url}<br>
          Tempo de Carregamento: ${((Date.now() - window.gameStartTime) / 1000).toFixed(1)}s
        `;
        debugButton.textContent = 'Ocultar Detalhes Técnicos';
      } else {
        debugInfo.style.display = 'none';
        debugButton.textContent = 'Mostrar Detalhes Técnicos';
      }
    });
    
    // Adicionar função de login
    button.addEventListener('click', () => {
      const playerName = input.value.trim();
      if (playerName) {
        button.disabled = true;
        button.style.backgroundColor = '#888';
        button.textContent = 'Entrando...';
        statusMessage.textContent = 'Conectando ao servidor...';
        statusMessage.style.color = 'yellow';
        
        // Callback de login com timeout
        const loginTimeout = setTimeout(() => {
          statusMessage.textContent = 'O servidor está demorando para responder. Verifique o console para mais detalhes (F12).';
          statusMessage.style.color = 'orange';
          button.disabled = false;
          button.style.backgroundColor = '#4CAF50';
          button.textContent = 'Tentar Novamente';
          
          // Mostrar detalhes técnicos automaticamente
          if (debugInfo.style.display === 'none') {
            debugInfo.style.display = 'block';
            debugInfo.innerHTML = `
              Status da Conexão: ${socketInfo.connected ? 'Conectado' : 'Desconectado'}<br>
              ID da Conexão: ${socketInfo.id || 'N/A'}<br>
              Modelos Carregados: ${socketInfo.assetsLoaded}/${socketInfo.assetsTotal}<br>
              URL do Servidor: ${socketInfo.url}<br>
              Tempo de Carregamento: ${((Date.now() - window.gameStartTime) / 1000).toFixed(1)}s
            `;
            debugButton.textContent = 'Ocultar Detalhes Técnicos';
          }
          
          console.error('Tempo limite de login excedido. Verifique a conexão com o servidor.');
        }, 8000);
        
        onLogin(playerName, loginScreen, loginTimeout);
      } else {
        statusMessage.textContent = 'Por favor, digite um nome de usuário.';
        statusMessage.style.color = 'red';
      }
    });
    
    // Também permitir login com Enter
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        button.click();
      }
    });
    
    return loginScreen;
  }
  
  /**
   * Mostra uma mensagem temporária na tela
   * @param {string} text - Texto da mensagem
   * @param {number} duration - Duração em ms (padrão: 3000ms)
   * @param {string} type - Tipo da mensagem (padrão: 'info', pode ser 'error', 'success', etc)
   */
  showMessage(text, duration = 3000, type = 'info') {
    console.log(`[UI] Mensagem: ${text}`);
    
    // Verificar se já temos um elemento de mensagem
    let messageElement = document.getElementById('game-message');
    
    // Se não existir, criar um novo
    if (!messageElement) {
      const styles = {
        position: 'absolute',
        top: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 20px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        textAlign: 'center',
        zIndex: '1000',
        transition: 'opacity 0.3s, transform 0.3s',
        opacity: '0',
        transform: 'translateX(-50%) translateY(-20px)'
      };
      
      // Ajustar cores baseado no tipo
      if (type === 'error') {
        styles.backgroundColor = 'rgba(220, 53, 69, 0.9)';
      } else if (type === 'success') {
        styles.backgroundColor = 'rgba(40, 167, 69, 0.9)';
      } else if (type === 'exp') {
        styles.backgroundColor = 'rgba(255, 193, 7, 0.9)';
        styles.color = 'black';
      }
      
      // Criar elemento
      messageElement = createElement('div', styles, { id: 'game-message' }, '', document.body);
    }
    
    // Definir texto e aplicar estilo específico para o tipo
    messageElement.textContent = text;
    
    if (type === 'error') {
      messageElement.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
    } else if (type === 'success') {
      messageElement.style.backgroundColor = 'rgba(40, 167, 69, 0.9)';
    } else if (type === 'exp') {
      messageElement.style.backgroundColor = 'rgba(255, 193, 7, 0.9)';
      messageElement.style.color = 'black';
    } else {
      messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      messageElement.style.color = 'white';
    }
    
    // Mostrar com animação
    setTimeout(() => {
      messageElement.style.opacity = '1';
      messageElement.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    // Limpar qualquer timer anterior
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
    }
    
    // Esconder após a duração
    this.messageTimer = setTimeout(() => {
      messageElement.style.opacity = '0';
      messageElement.style.transform = 'translateX(-50%) translateY(-20px)';
      
      // Remover do DOM após a transição
      setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
          messageElement.parentNode.removeChild(messageElement);
        }
      }, 300);
    }, duration);
  }
  
  /**
   * Mostra um número de dano flutuante sobre uma entidade
   * @param {Object} entity - Entidade que recebeu o dano
   * @param {number} amount - Quantidade de dano
   * @param {string} type - Tipo de dano (physical, magical, etc.)
   * @param {Object} options - Opções adicionais
   */
  showDamageNumber(entity, amount, type = 'physical', options = {}) {
    try {
      if (!entity || !entity.model) {
        console.warn("[UI] Tentativa de mostrar dano em entidade inválida");
        return;
      }
      
      console.log(`[${entity.id || 'Entity'}] Mostrando efeito de dano: ${amount}`);
      
      // Determinar cor baseada no tipo de dano
      let color = '#ffffff'; // branco (padrão)
      
      if (type === 'physical') {
        color = '#ff4444'; // vermelho
      } else if (type === 'magical') {
        color = '#44aaff'; // azul
      } else if (type === 'fire') {
        color = '#ff6600'; // laranja
      } else if (type === 'ice') {
        color = '#66ccff'; // azul claro
      } else if (type === 'poison') {
        color = '#66ff66'; // verde
      } else if (type === 'heal') {
        color = '#66ff66'; // verde
        amount = '+' + amount; // adicionar + para cura
      }
      
      // Ajustar tamanho e cor para críticos
      const fontSize = options.critical ? '24px' : '18px';
      const fontWeight = options.critical ? 'bold' : 'normal';
      
      // Criar elemento HTML para o número de dano
      const damageElement = document.createElement('div');
      damageElement.textContent = amount;
      damageElement.style.position = 'absolute';
      damageElement.style.color = color;
      damageElement.style.fontFamily = 'Arial, sans-serif';
      damageElement.style.fontSize = fontSize;
      damageElement.style.fontWeight = fontWeight;
      damageElement.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
      damageElement.style.pointerEvents = 'none';
      damageElement.style.zIndex = '1000';
      
      // Adicionar ao DOM
      document.body.appendChild(damageElement);
      
      // Posicionar elemento sobre a entidade
      const updatePosition = () => {
        if (!entity.model) {
          // Entidade não existe mais, remover elemento
          if (damageElement.parentNode) {
            damageElement.parentNode.removeChild(damageElement);
          }
          return;
        }
        
        try {
          // Obter posição da entidade no espaço 3D
          const entityPosition = new THREE.Vector3();
          entity.model.getWorldPosition(entityPosition);
          
          // Converter para coordenadas de tela
          const canvas = document.querySelector('canvas');
          if (!canvas) return;
          
          const canvasRect = canvas.getBoundingClientRect();
          const vector = entityPosition.clone();
          
          // Ajustar Y para mostrar acima da entidade
          vector.y += 1.5;
          
          // Verificar se a câmera está disponível
          if (!window.game || !window.game.renderer || !window.game.renderer.camera) {
            console.error("[UI] Câmera não disponível para projeção");
            if (damageElement.parentNode) {
              damageElement.parentNode.removeChild(damageElement);
            }
            return;
          }
          
          // Projetar para coordenadas 2D
          vector.project(window.game.renderer.camera);
          
          // Converter de coordenadas normalizadas (-1 a +1) para coordenadas de tela
          const x = (vector.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
          const y = (-vector.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top;
          
          // Aplicar posição
          damageElement.style.left = `${x}px`;
          damageElement.style.top = `${y}px`;
        } catch (error) {
          console.error("[UI] Erro ao atualizar posição do indicador de dano:", error);
          // Remover elemento em caso de erro para evitar problemas
          if (damageElement.parentNode) {
            damageElement.parentNode.removeChild(damageElement);
          }
        }
      };
      
      // Posicionar inicialmente
      updatePosition();
      
      // Animar o elemento
      let elapsed = 0;
      const duration = 1000; // 1 segundo
      const startTime = Date.now();
      const initialY = parseFloat(damageElement.style.top);
      
      // Função de animação
      const animate = () => {
        elapsed = Date.now() - startTime;
        
        if (elapsed < duration) {
          // Atualizar posição
          updatePosition();
          
          // Animar movimento para cima com fade out
          const progress = elapsed / duration;
          const offsetY = -50 * progress; // move para cima
          damageElement.style.opacity = 1 - progress; // fade out
          damageElement.style.transform = `translate(-50%, calc(-50% + ${offsetY}px))`;
          
          requestAnimationFrame(animate);
        } else {
          // Remover elemento no fim da animação
          if (damageElement.parentNode) {
            damageElement.parentNode.removeChild(damageElement);
          }
        }
      };
      
      // Iniciar animação
      requestAnimationFrame(animate);
    } catch (error) {
      console.error("[UI] Erro ao mostrar número de dano:", error);
    }
  }
  
  /**
   * Criar e mostrar o painel de depuração
   */
  createDebugPanel() {
    // Criar um painel flutuante de depuração
    const debugPanel = createElement('div', {
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      zIndex: '1000',
      fontFamily: 'monospace',
      fontSize: '12px',
      width: '250px',
      display: 'none'
    });
    
    // Adicionar título
    const title = createElement('div', {
      fontWeight: 'bold',
      marginBottom: '10px',
      borderBottom: '1px solid #666',
      paddingBottom: '5px',
      textAlign: 'center'
    }, {}, 'Painel de Depuração');
    
    // Criar opções do painel
    const options = [
      { id: 'enabled', label: 'Debug Ativado', type: 'checkbox' },
      { id: 'logCombat', label: 'Logs de Combate', type: 'checkbox' },
      { id: 'logMovement', label: 'Logs de Movimento', type: 'checkbox' },
      { id: 'logNetwork', label: 'Logs de Rede', type: 'checkbox' },
      { id: 'showHitboxes', label: 'Mostrar Hitboxes', type: 'checkbox' },
      { id: 'immortalPlayer', label: 'Jogador Imortal', type: 'checkbox' },
      { id: 'oneShotKill', label: 'One Shot Kill', type: 'checkbox' },
      { id: 'showStats', label: 'Estatísticas', type: 'checkbox' }
    ];
    
    // Adicionar opções ao painel
    const optionsContainer = createElement('div', {
      marginBottom: '10px'
    });
    
    // Para cada opção, criar um controle
    options.forEach(option => {
      const row = createElement('div', {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '5px'
      });
      
      const label = createElement('label', {
        marginRight: '10px'
      }, {
        for: `debug-${option.id}`
      }, option.label);
      
      const input = createElement('input', {}, {
        type: option.type,
        id: `debug-${option.id}`,
        checked: window.game?.DEBUG_CONFIG?.[option.id]
      });
      
      // Adicionar evento de mudança
      input.addEventListener('change', (e) => {
        if (window.game && window.game.toggleDebugOption) {
          window.game.toggleDebugOption(option.id, e.target.checked);
        }
      });
      
      row.appendChild(label);
      row.appendChild(input);
      optionsContainer.appendChild(row);
    });
    
    // Adicionar estatísticas
    const statsContainer = createElement('div', {
      marginTop: '10px',
      padding: '5px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '3px',
      fontFamily: 'monospace',
      fontSize: '11px'
    }, {
      id: 'debug-stats'
    });
    
    // Adicionar botão para abrir/fechar
    const toggleButton = createElement('button', {
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: '1001',
      padding: '5px 10px',
      backgroundColor: '#333',
      color: 'white',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer'
    }, {}, 'Debug');
    
    // Adicionar evento de clique
    toggleButton.addEventListener('click', () => {
      if (debugPanel.style.display === 'none') {
        debugPanel.style.display = 'block';
        toggleButton.textContent = 'Fechar';
      } else {
        debugPanel.style.display = 'none';
        toggleButton.textContent = 'Debug';
      }
    });
    
    // Montar o painel
    debugPanel.appendChild(title);
    debugPanel.appendChild(optionsContainer);
    debugPanel.appendChild(statsContainer);
    
    // Adicionar ao documento
    document.body.appendChild(debugPanel);
    document.body.appendChild(toggleButton);
    
    // Atualizar estatísticas periodicamente
    setInterval(() => {
      if (debugPanel.style.display !== 'none' && window.game) {
        const stats = {
          FPS: Math.round(1000 / ((window.performance.now() - (this._lastTime || 0)) || 1)),
          Entities: window.game.entityManager?.monsters.size + ' monstros, ' + window.game.entityManager?.players.size + ' jogadores',
          Memory: Math.round(window.performance.memory?.usedJSHeapSize / 1048576) + 'MB / ' + Math.round(window.performance.memory?.jsHeapSizeLimit / 1048576) + 'MB'
        };
        
        // Atualizar o container
        statsContainer.innerHTML = Object.entries(stats)
          .map(([key, value]) => `<div>${key}: ${value}</div>`)
          .join('');
        
        this._lastTime = window.performance.now();
      }
    }, 1000);
    
    return debugPanel;
  }
} 