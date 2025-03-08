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
    
    // HUD
    if (!this.elements.hud) {
      this.elements.hud = document.getElementById('hud');
      
      if (this.elements.hud) {
        this.elements.playerName = document.getElementById('player-name');
        this.elements.playerClass = document.getElementById('player-class');
        this.elements.hpBar = document.getElementById('player-hp-bar');
        this.elements.mpBar = document.getElementById('player-mp-bar');
        this.elements.hpText = document.getElementById('player-hp-text');
        this.elements.mpText = document.getElementById('player-mp-text');
        this.elements.controlsInfo = document.getElementById('controls-info');
      }
    }
  }
  
  /**
   * Atualiza a barra de progresso de carregamento
   * @param {number} increment - Incremento ao progresso (de 0 a 1)
   */
  updateLoadingProgress(increment) {
    if (!this.elements.progressBar) return;
    
    const currentWidth = parseFloat(this.elements.progressBar.style.width || '0');
    const newWidth = Math.min(currentWidth + increment * 100, 100);
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
  }
  
  /**
   * Atualiza as informações do jogador no HUD
   * @param {Object} player - Dados do jogador
   * @param {string} className - Nome da classe do jogador
   */
  updatePlayerInfo(player, className) {
    if (this.elements.playerName) {
      this.elements.playerName.textContent = player.name;
    }
    
    if (this.elements.playerClass) {
      this.elements.playerClass.textContent = className;
    }
    
    if (this.elements.hpBar) {
      this.elements.hpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
    }
    
    if (this.elements.mpBar) {
      this.elements.mpBar.style.width = `${(player.mp / player.maxMp) * 100}%`;
    }
    
    if (this.elements.hpText) {
      this.elements.hpText.textContent = `${player.hp} / ${player.maxHp}`;
    }
    
    if (this.elements.mpText) {
      this.elements.mpText.textContent = `${player.mp} / ${player.maxMp}`;
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
} 