# 🚀 ProduTrack Pro — Versão Comercial SaaS

Sistema completo de controle de tempo de produção com:
- ✅ Login / Cadastro por empresa
- ✅ Dashboard com gráficos
- ✅ Relatórios por período
- ✅ Exportação para Excel (3 abas formatadas)
- ✅ Sistema de planos (Free / Starter / Pro / Empresa)
- ✅ Multiusuário por empresa

---

## 📁 Estrutura

```
produtrack-pro/
├── backend/
│   ├── server.js          ← API completa
│   ├── package.json
│   └── produtrack.db      ← Banco SQLite (criado automaticamente)
├── frontend/
│   └── public/
│       └── index.html     ← App completo
├── railway.json           ← Config deploy Railway
├── Procfile               ← Config deploy Render
├── package.json           ← Root (para Railway)
└── README.md
```

---

## 💻 Rodar Localmente

```bash
cd backend
npm install
npm start
# Acesse: http://localhost:3001
```

---

## 🌐 DEPLOY NO RAILWAY (Recomendado)

### Por que Railway?
- Plano gratuito generoso ($5 de crédito/mês)
- Deploy automático ao fazer push no GitHub
- HTTPS automático
- Banco de dados persistente com volume

### Passo a passo:

**1. Suba o código no GitHub**
```bash
# Crie um repositório no github.com
git init
git add .
git commit -m "ProduTrack Pro v1.0"
git remote add origin https://github.com/SEU_USUARIO/produtrack-pro.git
git push -u origin main
```

**2. Deploy no Railway**
1. Acesse https://railway.app e crie conta (pode usar o GitHub)
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha o repositório `produtrack-pro`
5. Railway detecta automaticamente e faz o deploy

**3. Configure as variáveis de ambiente**
No painel do Railway → aba "Variables":
```
JWT_SECRET=sua_chave_secreta_muito_segura_aqui_2024
PORT=3001
```

**4. Configure volume persistente (IMPORTANTE para o banco)**
No Railway → aba "Volumes" → clique "Add Volume":
- Mount Path: `/app/backend`
- Isso garante que o `produtrack.db` não é apagado nos deploys

**5. Pegue a URL pública**
Railway gera automaticamente: `https://produtrack-pro-xxx.railway.app`

**Pronto!** Compartilhe essa URL com seus clientes. ✅

---

## 🌐 DEPLOY NO RENDER (Alternativa gratuita)

1. Acesse https://render.com → New Web Service
2. Conecte o repositório GitHub
3. Configurações:
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `node backend/server.js`
4. Environment Variables:
   - `JWT_SECRET` = sua_chave_secreta
5. Clique em "Create Web Service"

⚠️ No Render gratuito, o serviço "dorme" após 15 min sem uso.
Para produção, use o plano pago ($7/mês) ou Railway.

---

## 💰 Modelo de Negócio — Planos

| Plano    | Preço     | Usuários | Registros | Indicado para         |
|----------|-----------|----------|-----------|------------------------|
| Gratuito | R$ 0      | 1        | 30        | Teste/demonstração     |
| Starter  | R$ 49/mês | 3        | 500       | Pequenas empresas      |
| Pro      | R$ 99/mês | 10       | Ilimitado | Empresas médias        |
| Empresa  | R$ 199/mês| 50       | Ilimitado | Grandes empresas       |

### Como liberar upgrades de plano:
Acesse o banco `produtrack.db` com DB Browser for SQLite e altere:
```sql
UPDATE empresas SET plano = 'pro' WHERE id = 'ID_DA_EMPRESA';
```
*(No futuro, isso pode ser automatizado com gateway de pagamento)*

---

## 🔒 Segurança

- Senhas criptografadas com **bcrypt** (impossível de reverter)
- Autenticação via **JWT** com expiração de 7 dias
- Cada empresa só acessa seus próprios dados (isolamento total)
- HTTPS automático no Railway/Render

---

## 📊 Funcionalidades

### Dashboard
- KPIs: registros, horas, operadores, produtos distintos
- Gráfico de barras por processo
- Gráfico donut de distribuição
- Linha temporal de produção por dia
- Top produtos por tempo
- Por operador

### Registros
- Cronômetro com start/pause/reset
- 7 processos: Separação, Logística, Montagem, Pintura, Acabamento, Parado, Imprevistos
- Gráfico donut por registro
- Edição e exclusão

### Excel (3 abas)
- **Registros** — tabela completa com formatação profissional
- **Resumo por Processo** — totais em minutos e horas
- **Top Produtos** — ranking dos mais produzidos
- Filtro por período de datas
- Arquivo nomeado com empresa e data

---

## 🛠️ Manutenção

### Backup do banco
O banco fica em `backend/produtrack.db`. Copie esse arquivo regularmente.

### Adicionar usuário manualmente
Se o admin esquecer a senha, você pode resetar diretamente no banco:
```bash
# Gerar novo hash de senha (use Node.js):
node -e "const b=require('bcryptjs'); b.hash('nova_senha',10).then(h=>console.log(h))"
# Depois atualize no banco via DB Browser for SQLite
```

### Logs
No Railway, acesse a aba "Logs" para ver erros em tempo real.
