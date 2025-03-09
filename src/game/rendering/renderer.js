import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RENDER_CONFIG } from '../core/config';

/**
 * Classe para gerenciar a renderização 3D do jogo
 */
export class GameRenderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationFrame = null;
    this.renderCallbacks = [];
  }
  
  /**
   * Inicializa o renderizador
   * @returns {Object} Objetos de cena, câmera e renderizador
   */
  initialize() {
    // Criar cena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(RENDER_CONFIG.backgroundColor);
    
    // Configurar câmera ortográfica para visual isométrico
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = RENDER_CONFIG.frustumSize;
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    
    // Posição isométrica para a câmera
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);
    
    // Configurar renderizador
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);
    
    // Adicionar luzes
    this.addLights();
    
    // Configurar controles de câmera
    this.setupControls();
    
    // Configurar redimensionamento de janela
    this.setupWindowResize();
    
    return { scene: this.scene, camera: this.camera, renderer: this.renderer };
  }
  
  /**
   * Adiciona luzes à cena
   */
  addLights() {
    // Luz ambiente
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Luz direcional
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
  }
  
  /**
   * Configura os controles de câmera
   */
  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2.5;
  }
  
  /**
   * Configura o redimensionamento da janela
   */
  setupWindowResize() {
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      const frustumSize = RENDER_CONFIG.frustumSize;
      
      this.camera.left = frustumSize * aspect / -2;
      this.camera.right = frustumSize * aspect / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = frustumSize / -2;
      this.camera.updateProjectionMatrix();
      
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
  
  /**
   * Adiciona um callback para ser executado em cada quadro de animação
   * @param {Function} callback - Função a ser chamada em cada quadro
   */
  addRenderCallback(callback) {
    this.renderCallbacks.push(callback);
  }
  
  /**
   * Remove um callback de animação
   * @param {Function} callback - Função a ser removida
   */
  removeRenderCallback(callback) {
    this.renderCallbacks = this.renderCallbacks.filter(cb => cb !== callback);
  }
  
  /**
   * Inicia o loop de animação
   */
  startAnimationLoop() {
    // Parar loop anterior se existir
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    const animate = () => {
      this.animationFrame = requestAnimationFrame(animate);
      
      // Atualizar controles
      if (this.controls) {
        this.controls.update();
      }
      
      // Executar callbacks
      this.renderCallbacks.forEach(callback => callback());
      
      // Renderizar cena
      this.renderer.render(this.scene, this.camera);
    };
    
    animate();
  }
  
  /**
   * Para o loop de animação
   */
  stopAnimationLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
  
  /**
   * Cria um marcador visual no chão
   * @param {THREE.Vector3} position - Posição do marcador
   * @param {number} color - Cor em formato hexadecimal
   * @returns {THREE.Mesh} O marcador criado
   */
  createGroundMarker(position, color = 0xffff00) {
    // Aumentar o tamanho do marcador para ficar mais visível
    const markerGeometry = new THREE.CircleGeometry(0.5, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
      color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    
    // Posicionar o marcador ligeiramente acima do chão para evitar z-fighting
    marker.position.set(position.x, 0.02, position.z);
    marker.rotation.x = -Math.PI / 2; // Girar para ficar paralelo ao chão
    
    this.scene.add(marker);
    return marker;
  }
  
  /**
   * Cria um efeito visual de ataque
   * @param {THREE.Vector3} start - Posição inicial
   * @param {THREE.Vector3} end - Posição final
   * @param {number} color - Cor em formato hexadecimal
   * @param {number} duration - Duração em milissegundos
   */
  createAttackEffect(start, end, color = 0xff0000, duration = 400) {
    // Criar linha para o efeito de ataque
    const attackGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start.x, start.y + 0.5, start.z),
      new THREE.Vector3(end.x, end.y + 0.5, end.z)
    ]);
    
    const attackMaterial = new THREE.LineBasicMaterial({ 
      color,
      linewidth: 3
    });
    
    const attackLine = new THREE.Line(attackGeometry, attackMaterial);
    this.scene.add(attackLine);
    
    // Criar efeito de círculo de impacto na posição do monstro
    const impactGeometry = new THREE.CircleGeometry(0.6, 32);
    const impactMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    const impactCircle = new THREE.Mesh(impactGeometry, impactMaterial);
    impactCircle.position.set(end.x, 0.05, end.z);  // Ligeiramente acima do chão
    impactCircle.rotation.x = -Math.PI / 2;  // Paralelo ao chão
    this.scene.add(impactCircle);
    
    // Animar o círculo de impacto (crescimento e desaparecimento)
    let scale = 0.1;
    let opacity = 0.7;
    
    const animateImpact = () => {
      if (scale < 1.5) {
        scale += 0.1;
        opacity -= 0.05;
        
        if (impactCircle && impactCircle.material) {
          impactCircle.scale.set(scale, scale, scale);
          impactCircle.material.opacity = Math.max(0, opacity);
          
          requestAnimationFrame(animateImpact);
        }
      } else {
        this.scene.remove(impactCircle);
      }
    };
    
    animateImpact();
    
    // Remover a linha após a duração
    setTimeout(() => {
      this.scene.remove(attackLine);
      this.scene.remove(impactCircle);
    }, duration);
    
    return attackLine;
  }
  
  /**
   * Cria o solo do jogo
   */
  createGround() {
    // Grade de referência
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);
    
    // Plano para o chão
    const groundGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: RENDER_CONFIG.groundColor 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    
    this.scene.add(ground);
    return ground;
  }
  
  /**
   * Limpa a cena removendo todos os objetos
   */
  clearScene() {
    while(this.scene.children.length > 0){ 
      this.scene.remove(this.scene.children[0]); 
    }
    
    // Readicionar as luzes
    this.addLights();
  }
  
  /**
   * Destrói o renderizador e libera recursos
   */
  dispose() {
    this.stopAnimationLoop();
    
    if (this.renderer) {
      this.renderer.dispose();
      document.body.removeChild(this.renderer.domElement);
    }
    
    if (this.controls) {
      this.controls.dispose();
    }
    
    this.clearScene();
  }
} 