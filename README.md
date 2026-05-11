<div align="center">

# 🎵 Soundwave
### Plataforma de Streaming de Música — Polyglot Persistence

![License](https://img.shields.io/badge/license-MIT-purple)
![Docker](https://img.shields.io/badge/Docker-required-blue?logo=docker)
![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green?logo=mongodb)
![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)

> Projeto acadêmico de **Polyglot Persistence**: uso estratégico de diferentes bancos de dados conforme a natureza do dado manipulado pela aplicação.

</div>

---

## 📋 Índice

- [Tema do Projeto](#-tema-do-projeto)
- [Arquitetura](#-arquitetura)
- [Justificativa dos Bancos](#-justificativa-dos-bancos)
- [Implementação do Backend](#-implementação-do-backend)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Como Executar](#-como-executar)
- [Visualizando os Bancos de Dados](#-visualizando-os-bancos-de-dados)
- [Endpoints da API](#-endpoints-da-api)

---

## 🎯 Tema do Projeto

**Soundwave** é uma plataforma de streaming de música inspirada no Spotify, com três domínios de dados bem definidos que justificam o uso de diferentes bancos:

| Domínio | Responsável | Banco |
|---|---|---|
| 👤 Usuários cadastrados | `user-service` | PostgreSQL |
| 🎵 Catálogo de músicas | `music-service` | MongoDB |
| ▶️ Playback e histórico | `playback-service` | Redis |

A plataforma permite cadastrar usuários, gerenciar um catálogo de álbuns com faixas aninhadas, montar playlists, reproduzir músicas e consultar o histórico de reprodução — tudo com operações CRUD completas em cada domínio.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND  (porta 8080)                     │
│             HTML + CSS + JS servido via Nginx                │
└────────────┬──────────────┬───────────────┬─────────────────┘
             │              │               │
             ▼              ▼               ▼
┌────────────────┐  ┌───────────────┐  ┌──────────────────┐
│  user-service  │  │ music-service │  │playback-service  │
│    porta 3001  │  │   porta 3002  │  │    porta 3003    │
│   Node.js +    │  │   Node.js +   │  │   Node.js +      │
│    Express     │  │    Express    │  │    Express       │
└───────┬────────┘  └──────┬────────┘  └────────┬─────────┘
        │                  │                     │
        ▼                  ▼                     ▼
┌──────────────┐  ┌────────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │    MongoDB     │  │      Redis       │
│  porta 5432  │  │  porta 27017   │  │    porta 6379    │
│  (Usuários)  │  │  (Catálogo)    │  │   (Playback)     │
└──────────────┘  └────────────────┘  └──────────────────┘
```

O modelo segue a arquitetura exigida:

```
FE <──> BE <──> RDB  (PostgreSQL)
             <──> DB1 (MongoDB)
             <──> DB2 (Redis)
```

---

## 🗄️ Justificativa dos Bancos

### 🐘 PostgreSQL — Banco Relacional (RDB)

Dados de usuários possuem estrutura fixa e bem definida: nome, email, senha e plano de assinatura. Essas características justificam o uso de um banco relacional porque:

- **Integridade**: unicidade de email garantida via constraint
- **Transações ACID**: operações seguras e consistentes
- **Schema fixo**: estrutura dos dados não muda com frequência
- **Queries relacionais**: facilidade para filtros e agregações (ex: contar usuários por plano)

```sql
-- Exemplo da tabela de usuários
CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    plan       VARCHAR(20)  DEFAULT 'free',
    created_at TIMESTAMPTZ  DEFAULT NOW()
);
```

---

### 🍃 MongoDB — Document Store (DB1)

O catálogo musical é naturalmente **hierárquico**: um álbum possui título, artista, gênero, ano e um array de faixas, onde cada faixa tem ordem, título e duração. Esse modelo justifica o MongoDB porque:

- **Documento aninhado**: álbum + faixas em um único documento, eliminando JOINs
- **Schema flexível**: novos campos (ex: `lyrics`, `BPM`, `mood`) podem ser adicionados sem migrações
- **Busca por texto**: índice fulltext nativo para buscar por título de álbum ou faixa
- **Performance**: leitura de um álbum completo em uma única operação

```json
// Exemplo de documento no MongoDB
{
  "_id": "ObjectId(...)",
  "title": "Midnight Echoes",
  "artist": "The Neon Ghosts",
  "genre": "Synthwave",
  "year": 2023,
  "tracks": [
    { "order": 1, "title": "Neon Rain", "duration_s": 214 },
    { "order": 2, "title": "Phantom Drive", "duration_s": 198 }
  ]
}
```

---

### ⚡ Redis — Key-Value / Lists (DB2)

Dados de playback (faixa tocando agora, histórico de reprodução, playlist) precisam de **latência mínima** e não requerem durabilidade forte. O Redis é ideal porque:

- **Latência sub-milissegundo**: acesso instantâneo ao estado do player
- **Estruturas nativas**: Lists para playlist e histórico ordenado, Hash para now-playing
- **Operações atômicas**: `LPUSH` + `LTRIM` garantem histórico com limite de 50 itens
- **Dados efêmeros**: playback é por natureza temporário, não precisa de persistência forte

```
# Estrutura das chaves no Redis
playlist:{userId}     → List  ["track_1", "track_2", ...]
history:{userId}      → List  (últimas 50 reproduções)
nowplaying:{userId}   → Hash  { trackId, title, albumId, startedAt }
```

---

## ⚙️ Implementação do Backend

O backend é dividido em **3 microserviços independentes**, cada um responsável por um domínio e um banco de dados:

### `user-service` (porta 3001) → PostgreSQL
Gerencia o ciclo de vida dos usuários cadastrados na plataforma.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/users` | Criar usuário |
| GET | `/users` | Listar todos |
| GET | `/users/:id` | Buscar por ID |
| PUT | `/users/:id` | Atualizar |
| DELETE | `/users/:id` | Excluir |

### `music-service` (porta 3002) → MongoDB
Gerencia o catálogo de álbuns com suas faixas aninhadas.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/albums` | Criar álbum |
| GET | `/albums` | Listar/buscar álbuns |
| GET | `/albums/:id` | Buscar por ID |
| PUT | `/albums/:id` | Atualizar |
| DELETE | `/albums/:id` | Excluir |

### `playback-service` (porta 3003) → Redis
Gerencia playlist, histórico de reprodução e estado do player.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/playlist/:userId` | Adicionar faixa à playlist |
| GET | `/playlist/:userId` | Ver playlist |
| PUT | `/playlist/:userId/:idx` | Atualizar faixa na posição |
| DELETE | `/playlist/:userId` | Limpar playlist |
| POST | `/play/:userId` | Reproduzir faixa |
| GET | `/nowplaying/:userId` | Ver o que está tocando |
| GET | `/history/:userId` | Ver histórico |
| DELETE | `/history/:userId` | Limpar histórico |

---

## 📁 Estrutura do Repositório

```
soundwave/
├── 📄 docker-compose.yml          # Orquestração de todos os serviços
├── 📄 README.md
│
├── 📁 docker/
│   ├── postgres-init.sql          # Schema e seed do PostgreSQL
│   └── mongo-init.js              # Seed do MongoDB
│
├── 📁 backend/
│   ├── 📁 user-service/           # CRUD de usuários → PostgreSQL
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/index.js
│   │
│   ├── 📁 music-service/          # CRUD do catálogo → MongoDB
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/index.js
│   │
│   └── 📁 playback-service/       # Playlist e histórico → Redis
│       ├── Dockerfile
│       ├── package.json
│       └── src/index.js
│
└── 📁 frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── index.html                 # SPA com todas as operações CRUD
```

---

## 🚀 Como Executar

### Pré-requisitos

Apenas o **Docker** precisa estar instalado. Nenhuma outra dependência é necessária.

- 🐳 [Docker](https://docs.docker.com/get-docker/) ≥ 24
- 🐳 Docker Compose (incluído no Docker Desktop)

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/soundwave.git
cd soundwave

# 2. Suba todos os serviços
docker compose up --build

# (ou no Linux com versão antiga do Docker)
docker-compose up --build

# 3. Aguarde as mensagens de confirmação:
# ✅ user-service listening on :3001
# ✅ music-service connected to MongoDB
# ✅ playback-service connected to Redis

# 4. Acesse o frontend
# http://localhost:8080
```

Para rodar em segundo plano:
```bash
docker compose up --build -d
```

Para parar:
```bash
docker compose down        # Para os containers
docker compose down -v     # Para e apaga os dados
```

### Serviços e Portas

| Serviço | URL | Tecnologia |
|---|---|---|
| 🌐 Frontend | http://localhost:8080 | HTML/CSS/JS + Nginx |
| 👤 user-service | http://localhost:3001 | Node.js + Express + pg |
| 🎵 music-service | http://localhost:3002 | Node.js + Express + mongodb |
| ▶️ playback-service | http://localhost:3003 | Node.js + Express + ioredis |
| 🐘 PostgreSQL | localhost:5432 | postgres:16-alpine |
| 🍃 MongoDB | localhost:27017 | mongo:7 |
| ⚡ Redis | localhost:6379 | redis:7-alpine |

### Verificar saúde dos serviços

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

---

## 🔍 Visualizando os Bancos de Dados

### PostgreSQL — pgAdmin
```
Host:     localhost
Port:     5432
Database: soundwave_users
Username: soundwave
Password: soundwave123
```

### MongoDB — MongoDB Compass
```
mongodb://soundwave:soundwave123@localhost:27017/soundwave_music?authSource=admin
```

### Redis — Redis Commander (via Docker)
```bash
docker run -d \
  --network soundwave_soundwave_net \
  -p 8081:8081 \
  -e REDIS_HOST=redis \
  -e REDIS_PASSWORD=soundwave123 \
  rediscommander/redis-commander
```
Acesse: http://localhost:8081

---

## 🧪 Testando a API

```bash
# Criar usuário
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name":"João Silva","email":"joao@test.com","password":"123456","plan":"premium"}'

# Listar álbuns
curl http://localhost:3002/albums

# Buscar álbum por gênero
curl "http://localhost:3002/albums?genre=Synthwave"

# Reproduzir faixa (userId=1)
curl -X POST http://localhost:3003/play/1 \
  -H "Content-Type: application/json" \
  -d '{"trackId":"t001","title":"Neon Rain","albumId":"aaaaaaaaaaaaaaaaaaaaaaaa"}'

# Ver histórico do usuário 1
curl http://localhost:3003/history/1

# Ver o que está tocando
curl http://localhost:3003/nowplaying/1
```

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 20 | Runtime dos microserviços |
| Express | 4.18 | Framework HTTP |
| PostgreSQL | 16 | Banco relacional |
| MongoDB | 7 | Banco de documentos |
| Redis | 7 | Banco key-value |
| Docker | 24+ | Containerização |
| Docker Compose | 2+ | Orquestração |
| Nginx | latest | Servidor do frontend |

---

<div align="center">
Projeto desenvolvido para a disciplina de Banco de Dados
</div>
