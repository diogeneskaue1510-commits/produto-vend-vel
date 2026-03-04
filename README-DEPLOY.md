# ProduTrack Pro — Deploy no Railway

## PASSO A PASSO COMPLETO

### 1. Instale o Git (se não tiver)
https://git-scm.com/download/win

### 2. Crie conta no GitHub
https://github.com → Sign up (gratuito)

### 3. Crie repositório no GitHub
- Clique em "New repository"
- Nome: produtrack-pro
- Deixe público
- Clique em "Create repository"

### 4. Suba o código para o GitHub
Abra o terminal na pasta `produtrack-pro` e rode:

```bash
git init
git add .
git commit -m "ProduTrack Pro v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/produtrack-pro.git
git push -u origin main
```

### 5. Crie conta no Railway
https://railway.app → Login with GitHub

### 6. Deploy no Railway
1. Clique em "New Project"
2. "Deploy from GitHub repo" → selecione `produtrack-pro`
3. Railway detecta o projeto automaticamente
4. Clique em "Add Service" → "Database" → "PostgreSQL"
5. No serviço Node.js, vá em "Variables" e adicione:
   - `DATABASE_URL` → clique em "Add Reference" → selecione o PostgreSQL (Railway preenche automático)
   - `JWT_SECRET` → qualquer texto longo, ex: `produtrack_secret_2024_xkz92ms`
   - `NODE_ENV` → `production`
6. Em "Settings" → "Root Directory" → deixe vazio
7. Em "Settings" → "Start Command" → `node backend/server.js`
8. Deploy automático! Aguarde ~2 minutos.

### 7. Acesse sua URL
Railway gera uma URL como:
https://produtrack-pro-production.up.railway.app

Essa URL funciona de qualquer lugar do mundo! 🌍

---

## TESTAR LOCAL ANTES DO DEPLOY

### Instale PostgreSQL local (opcional)
Ou use o Railway mesmo para teste.

### Rode localmente com Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway run npm start
```

### Ou configure manualmente:
1. Crie arquivo `backend/.env` baseado no `.env.example`
2. Preencha DATABASE_URL com seu PostgreSQL
3. `cd backend && npm install && npm start`

---

## ESTRUTURA DO PROJETO

```
produtrack-pro/
├── backend/
│   ├── server.js        ← API completa (Auth + Registros + Excel)
│   ├── db.js            ← Conexão PostgreSQL
│   ├── package.json
│   ├── .env.example     ← Modelo de variáveis de ambiente
│   └── .gitignore
├── frontend/
│   └── public/
│       └── index.html   ← Frontend completo
├── Procfile             ← Para Railway/Heroku
└── README-DEPLOY.md     ← Este arquivo
```

---

## FUNCIONALIDADES

✅ Login e cadastro de usuários
✅ Cada usuário vê apenas seus registros
✅ Sessão de 7 dias (não precisa logar toda vez)
✅ Dashboard com KPIs e gráficos
✅ Filtro por período em todas as telas
✅ Registros com gráfico donut por produto
✅ Editar e excluir registros
✅ Cronômetro integrado
✅ Exportar Excel com 3 abas (Detalhado + Por Processo + Por Produto)
✅ Relatório por período com botão de exportação
✅ 100% responsivo (celular, tablet, desktop)
✅ Banco PostgreSQL (dados persistentes em produção)
