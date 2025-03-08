import { io } from 'socket.io-client';
import { CONNECTION_CONFIG } from './config';

/**
 * Classe para gerenciar a conexão de rede do jogo
 */
export class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.connectHandlers = [];
    this.disconnectHandlers = [];
    this.errorHandlers = [];
    this.eventHandlers = {};
  }
  
  /**
   * Conecta ao servidor de jogo
   * @returns {Promise} Promessa resolvida quando a conexão for estabelecida
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Inicializar conexão Socket.io
        this.socket = io('/', CONNECTION_CONFIG);
        
        // Configurar handler de conexão
        this.socket.on('connect', () => {
          console.log('Conectado ao servidor Socket.IO!');
          this.connected = true;
          
          // Configurar todos os ouvintes de eventos após a conexão
          Object.entries(this.eventHandlers).forEach(([event, handlers]) => {
            console.log(`Reconfigurando ouvinte para o evento '${event}' após a conexão`);
            this.socket.on(event, (...args) => {
              console.log(`Evento '${event}' recebido com args:`, args);
              handlers.forEach(handler => handler(...args));
            });
          });
          
          // Notificar handlers
          this.connectHandlers.forEach(handler => handler(this.socket));
          
          resolve(this.socket);
        });
        
        // Configurar handler de erro de conexão
        this.socket.on('connect_error', (error) => {
          console.error('Erro de conexão com o servidor:', error);
          
          // Notificar handlers
          this.errorHandlers.forEach(handler => handler(error));
          
          reject(error);
        });
        
        // Configurar handler de desconexão
        this.socket.on('disconnect', (reason) => {
          console.log('Desconectado do servidor:', reason);
          this.connected = false;
          
          // Notificar handlers
          this.disconnectHandlers.forEach(handler => handler(reason));
        });
      } catch (error) {
        console.error('Erro ao inicializar conexão:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Adiciona um handler para o evento de conexão
   * @param {Function} handler - Função a ser chamada quando conectar
   */
  onConnect(handler) {
    this.connectHandlers.push(handler);
    
    // Se já estiver conectado, chamar o handler imediatamente
    if (this.connected && this.socket) {
      handler(this.socket);
    }
  }
  
  /**
   * Adiciona um handler para o evento de desconexão
   * @param {Function} handler - Função a ser chamada quando desconectar
   */
  onDisconnect(handler) {
    this.disconnectHandlers.push(handler);
  }
  
  /**
   * Adiciona um handler para o evento de erro
   * @param {Function} handler - Função a ser chamada quando ocorrer um erro
   */
  onError(handler) {
    this.errorHandlers.push(handler);
  }
  
  /**
   * Adiciona um handler para um evento específico
   * @param {string} event - Nome do evento
   * @param {Function} handler - Função a ser chamada quando o evento ocorrer
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
      
      // Configurar o listener no socket
      if (this.socket) {
        console.log(`Configurando listener para o evento '${event}'`);
        this.socket.on(event, (...args) => {
          console.log(`Evento '${event}' recebido com args:`, args);
          this.eventHandlers[event].forEach(h => h(...args));
        });
      } else {
        console.warn(`Tentativa de configurar listener para '${event}' mas o socket ainda não foi inicializado`);
      }
    }
    
    this.eventHandlers[event].push(handler);
  }
  
  /**
   * Remove um handler para um evento específico
   * @param {string} event - Nome do evento
   * @param {Function} handler - Função a ser removida
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }
  
  /**
   * Emite um evento para o servidor
   * @param {string} event - Nome do evento
   * @param {any} data - Dados a serem enviados
   */
  emit(event, data) {
    if (this.socket && this.connected) {
      console.log(`Emitindo evento '${event}' com dados:`, data);
      this.socket.emit(event, data);
    } else {
      console.warn(`Tentativa de emitir evento '${event}' enquanto desconectado. Estado do socket:`, this.getDebugInfo());
    }
  }
  
  /**
   * Desconecta do servidor
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
  
  /**
   * Obtém informações para depuração
   * @returns {Object} Informações do socket
   */
  getDebugInfo() {
    return {
      connected: this.connected,
      id: this.socket ? this.socket.id : null,
      url: this.socket ? this.socket.io.uri : null
    };
  }
} 