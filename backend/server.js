// ============================================================
// server.js — ProduTrack Pro
// Node.js + Express + PostgreSQL + JWT + Excel
// ============================================================
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const os        = require('os');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const ExcelJS   = require('exceljs');
const { pool, initDB } = require('./db');

const app    = express();
const PORT   = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ─── PROCS ────────────────────────────────────────────────────
const PROCS = ['separacao','logistica','montagem','pintura','acabamento','parado','imprevistos'];
const PROC_LABELS = {
  separacao:'Separação', logistica:'Logística', montagem:'Montagem',
  pintura:'Pintura', acabamento:'Acabamento', parado:'Parado', imprevistos:'Imprevistos'
};

function calcTotal(b) {
  return PROCS.reduce((acc, k) => acc + (parseInt(b[k]) || 0), 0);
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ erro: 'Token não fornecido' });
  try {
    req.user = jwt.verify(h.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }
}

// ═══════════════════════════════════════════════════════
// ROTAS AUTH
// ═══════════════════════════════════════════════════════

// Cadastro
app.post('/api/auth/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome?.trim() || !email?.trim() || !senha)
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
    if (senha.length < 4)
      return res.status(400).json({ erro: 'Senha deve ter pelo menos 4 caracteres' });

    const existe = await pool.query('SELECT id FROM usuarios WHERE email=$1', [email.toLowerCase().trim()]);
    if (existe.rows.length)
      return res.status(409).json({ erro: 'Este e-mail já está cadastrado' });

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nome,email,senha_hash) VALUES ($1,$2,$3) RETURNING id,nome,email,plano',
      [nome.trim(), email.toLowerCase().trim(), hash]
    );
    const u = rows[0];
    const token = jwt.sign({ id: u.id, nome: u.nome, email: u.email, plano: u.plano }, SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, usuario: u });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'E-mail e senha obrigatórios' });

    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email.toLowerCase().trim()]);
    if (!rows.length) return res.status(401).json({ erro: 'E-mail ou senha incorretos' });

    const u = rows[0];
    if (!u.ativo) return res.status(403).json({ erro: 'Conta desativada' });
    if (!await bcrypt.compare(senha, u.senha_hash))
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });

    const token = jwt.sign({ id: u.id, nome: u.nome, email: u.email, plano: u.plano }, SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: u.id, nome: u.nome, email: u.email, plano: u.plano } });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Perfil
app.get('/api/auth/me', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT id,nome,email,plano,criado_em FROM usuarios WHERE id=$1', [req.user.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(rows[0]);
});

// ═══════════════════════════════════════════════════════
// ROTAS REGISTROS
// ═══════════════════════════════════════════════════════

// Listar com filtro de período
app.get('/api/registros', auth, async (req, res) => {
  try {
    const { inicio, fim, produto } = req.query;
    let sql = 'SELECT * FROM registros WHERE usuario_id=$1';
    const params = [req.user.id];
    let i = 2;

    if (inicio) { sql += ` AND criado_em >= $${i++}`; params.push(inicio); }
    if (fim)    { sql += ` AND criado_em <= $${i++}`; params.push(fim + ' 23:59:59'); }
    if (produto){ sql += ` AND LOWER(produto_nome) LIKE $${i++}`; params.push('%' + produto.toLowerCase() + '%'); }

    sql += ' ORDER BY criado_em DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Criar
app.post('/api/registros', auth, async (req, res) => {
  try {
    const { produto_nome, observacao } = req.body;
    if (!produto_nome?.trim()) return res.status(400).json({ erro: 'Nome do produto é obrigatório' });
    const total = calcTotal(req.body);
    if (total === 0) return res.status(400).json({ erro: 'Informe ao menos um processo com tempo maior que zero' });

    const vals = PROCS.map(k => parseInt(req.body[k]) || 0);
    const { rows } = await pool.query(`
      INSERT INTO registros (usuario_id,produto_nome,separacao,logistica,montagem,pintura,acabamento,parado,imprevistos,total_minutos,observacao)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, produto_nome.trim(), ...vals, total, observacao || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Atualizar
app.put('/api/registros/:id', auth, async (req, res) => {
  try {
    const { produto_nome, observacao } = req.body;
    if (!produto_nome?.trim()) return res.status(400).json({ erro: 'Nome do produto é obrigatório' });

    const existe = await pool.query('SELECT id FROM registros WHERE id=$1 AND usuario_id=$2', [req.params.id, req.user.id]);
    if (!existe.rows.length) return res.status(404).json({ erro: 'Registro não encontrado' });

    const vals = PROCS.map(k => parseInt(req.body[k]) || 0);
    const total = calcTotal(req.body);
    const { rows } = await pool.query(`
      UPDATE registros SET produto_nome=$1,separacao=$2,logistica=$3,montagem=$4,pintura=$5,acabamento=$6,parado=$7,imprevistos=$8,total_minutos=$9,observacao=$10,atualizado_em=NOW()
      WHERE id=$11 AND usuario_id=$12 RETURNING *`,
      [produto_nome.trim(), ...vals, total, observacao || null, req.params.id, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Excluir
app.delete('/api/registros/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM registros WHERE id=$1 AND usuario_id=$2 RETURNING id', [req.params.id, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ erro: 'Registro não encontrado' });
    res.json({ mensagem: 'Excluído com sucesso' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ═══════════════════════════════════════════════════════
// DASHBOARD — estatísticas
// ═══════════════════════════════════════════════════════
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { inicio, fim } = req.query;
    let where = 'WHERE usuario_id=$1';
    const params = [uid];
    let i = 2;
    if (inicio) { where += ` AND criado_em >= $${i++}`; params.push(inicio); }
    if (fim)    { where += ` AND criado_em <= $${i++}`; params.push(fim + ' 23:59:59'); }

    const [totais, porDia, porProduto] = await Promise.all([
      // Totais gerais por processo
      pool.query(`
        SELECT
          COUNT(*)::int as total_registros,
          COALESCE(SUM(total_minutos),0)::int as total_minutos,
          COALESCE(SUM(separacao),0)::int as separacao,
          COALESCE(SUM(logistica),0)::int as logistica,
          COALESCE(SUM(montagem),0)::int as montagem,
          COALESCE(SUM(pintura),0)::int as pintura,
          COALESCE(SUM(acabamento),0)::int as acabamento,
          COALESCE(SUM(parado),0)::int as parado,
          COALESCE(SUM(imprevistos),0)::int as imprevistos
        FROM registros ${where}`, params),

      // Registros por dia (últimos 30 dias)
      pool.query(`
        SELECT
          DATE(criado_em AT TIME ZONE 'America/Sao_Paulo') as dia,
          COUNT(*)::int as qtd,
          SUM(total_minutos)::int as minutos
        FROM registros ${where}
        GROUP BY dia ORDER BY dia DESC LIMIT 30`, params),

      // Top produtos
      pool.query(`
        SELECT produto_nome,
          COUNT(*)::int as qtd,
          SUM(total_minutos)::int as total_minutos
        FROM registros ${where}
        GROUP BY produto_nome
        ORDER BY total_minutos DESC LIMIT 10`, params),
    ]);

    res.json({
      totais: totais.rows[0],
      porDia: porDia.rows,
      porProduto: porProduto.rows,
    });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ═══════════════════════════════════════════════════════
// EXPORTAR EXCEL
// ═══════════════════════════════════════════════════════
app.get('/api/exportar/excel', auth, async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    let sql = 'SELECT * FROM registros WHERE usuario_id=$1';
    const params = [req.user.id];
    if (inicio) { sql += ' AND criado_em >= $2'; params.push(inicio); }
    if (fim)    { sql += ` AND criado_em <= $${params.length+1}`; params.push(fim + ' 23:59:59'); }
    sql += ' ORDER BY criado_em DESC';

    const { rows } = await pool.query(sql, params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ProduTrack Pro';
    wb.created = new Date();

    // ── Aba 1: Registros detalhados
    const ws1 = wb.addWorksheet('Registros');
    ws1.columns = [
      { header: 'Produto',      key: 'produto_nome', width: 28 },
      { header: 'Data',         key: 'criado_em',    width: 20 },
      { header: 'Separação',    key: 'separacao',    width: 13 },
      { header: 'Logística',    key: 'logistica',    width: 13 },
      { header: 'Montagem',     key: 'montagem',     width: 13 },
      { header: 'Pintura',      key: 'pintura',      width: 13 },
      { header: 'Acabamento',   key: 'acabamento',   width: 13 },
      { header: 'Parado',       key: 'parado',       width: 13 },
      { header: 'Imprevistos',  key: 'imprevistos',  width: 13 },
      { header: 'Total (min)',  key: 'total_minutos',width: 13 },
      { header: 'Total (h:mm)', key: 'total_hhmm',   width: 13 },
      { header: 'Observações',  key: 'observacao',   width: 32 },
    ];

    // Header style
    ws1.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A6E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF2563EB' } } };
    });
    ws1.getRow(1).height = 24;

    rows.forEach((r, idx) => {
      const h = Math.floor(r.total_minutos / 60);
      const m = r.total_minutos % 60;
      const row = ws1.addRow({
        produto_nome:  r.produto_nome,
        criado_em:     new Date(r.criado_em).toLocaleString('pt-BR'),
        separacao:     r.separacao,
        logistica:     r.logistica,
        montagem:      r.montagem,
        pintura:       r.pintura,
        acabamento:    r.acabamento,
        parado:        r.parado,
        imprevistos:   r.imprevistos,
        total_minutos: r.total_minutos,
        total_hhmm:    `${h}h ${String(m).padStart(2,'0')}min`,
        observacao:    r.observacao || '',
      });
      // Linhas alternadas
      if (idx % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        });
      }
      row.getCell('total_minutos').font = { bold: true };
      row.getCell('total_hhmm').font    = { bold: true, color: { argb: 'FF1D4ED8' } };
    });

    // ── Aba 2: Resumo por processo
    const ws2 = wb.addWorksheet('Resumo por Processo');
    const totals = {};
    PROCS.forEach(k => { totals[k] = rows.reduce((a, r) => a + (r[k] || 0), 0); });
    const grandTotal = rows.reduce((a, r) => a + r.total_minutos, 0);

    ws2.columns = [
      { header: 'Processo',      key: 'proc',  width: 20 },
      { header: 'Total (min)',   key: 'min',   width: 14 },
      { header: 'Total (h:mm)', key: 'hhmm',  width: 14 },
      { header: '% do Total',   key: 'pct',   width: 14 },
    ];

    ws2.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A6E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws2.getRow(1).height = 24;

    PROCS.forEach(k => {
      const min = totals[k];
      const h = Math.floor(min / 60), m = min % 60;
      const pct = grandTotal > 0 ? ((min / grandTotal) * 100).toFixed(1) + '%' : '0%';
      ws2.addRow({ proc: PROC_LABELS[k], min, hhmm: `${h}h ${String(m).padStart(2,'0')}min`, pct });
    });
    // Linha total
    const gt_h = Math.floor(grandTotal/60), gt_m = grandTotal%60;
    const totalRow = ws2.addRow({ proc: 'TOTAL', min: grandTotal, hhmm: `${gt_h}h ${String(gt_m).padStart(2,'0')}min`, pct: '100%' });
    totalRow.eachCell(c => { c.font = { bold: true }; c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFE0EBFF' } }; });

    // ── Aba 3: Resumo por produto
    const ws3 = wb.addWorksheet('Resumo por Produto');
    const byProd = {};
    rows.forEach(r => {
      if (!byProd[r.produto_nome]) byProd[r.produto_nome] = { qtd: 0, total: 0 };
      byProd[r.produto_nome].qtd++;
      byProd[r.produto_nome].total += r.total_minutos;
    });

    ws3.columns = [
      { header: 'Produto',     key: 'prod', width: 28 },
      { header: 'Registros',   key: 'qtd',  width: 13 },
      { header: 'Total (min)', key: 'min',  width: 14 },
      { header: 'Total (h:mm)',key: 'hhmm', width: 14 },
      { header: 'Média (min)', key: 'med',  width: 14 },
    ];
    ws3.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A6E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws3.getRow(1).height = 24;

    Object.entries(byProd).sort((a,b) => b[1].total - a[1].total).forEach(([nome, d]) => {
      const h = Math.floor(d.total/60), m = d.total%60;
      ws3.addRow({ prod: nome, qtd: d.qtd, min: d.total, hhmm: `${h}h ${String(m).padStart(2,'0')}min`, med: Math.round(d.total/d.qtd) });
    });

    // Envia o arquivo
    const periodo = inicio ? `_${inicio}_a_${fim||'hoje'}` : '';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ProduTrack${periodo}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// SPA catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ─── START ─────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const ifaces = os.networkInterfaces();
    let ip = 'localhost';
    Object.values(ifaces).flat().forEach(d => { if (d.family==='IPv4' && !d.internal) ip = d.address; });
    console.log(`\n🚀 ProduTrack Pro rodando!`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`📱 Rede:  http://${ip}:${PORT}\n`);
  });
}).catch(err => { console.error('❌ Falha ao iniciar banco:', err.message); process.exit(1); });
