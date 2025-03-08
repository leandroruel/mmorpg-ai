# MMORPG Estilo Ragnarok Online

Um jogo MMORPG inspirado no Ragnarok Online, com visual isométrico usando Three.js e comunicação em tempo real via Socket.io.

## Características

- Visual isométrico com câmera ortográfica
- Movimentação com WASD ou setas
- Sistema de combate básico (clique para atacar monstros)
- Multiplayer em tempo real
- Modelos 3D (GLTF/GLB)

## Requisitos

- Node.js 14+
- NPM 6+

## Instalação

1. Clone o repositório
2. Instale as dependências:

```bash
npm install
```

## Desenvolvimento

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

Isso iniciará tanto o servidor backend quanto o cliente frontend.

- O servidor backend roda na porta 3000
- O cliente frontend é servido pelo webpack-dev-server na porta 8080
- As requisições de API e conexões WebSocket são automaticamente encaminhadas ao servidor backend através de um proxy

## Estrutura do Projeto

```
├── public/              # Arquivos estáticos
│   ├── models/          # Modelos 3D
│   └── index.html       # Página HTML principal
├── src/                 # Código fonte
│   ├── 3d/              # Assets 3D
│   ├── server/          # Código do servidor
│   └── index.js         # Código principal do cliente
└── package.json         # Dependências e scripts
```

## Controles

- W, A, S, D ou Setas: Mover o personagem
- Clique do mouse: Atacar monstros

## Próximos Passos

- Implementar sistema de inventário
- Adicionar mais tipos de monstros
- Implementar sistema de níveis e experiência
- Adicionar habilidades e magias
- Melhorar os modelos 3D e animações 