// ============================================================
// db.js — Conexão com PostgreSQL
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    // Cria tabelas se não existirem
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome        TEXT NOT NULL,
        email       TEXT NOT NULL UNIQUE,
        senha_hash  TEXT NOT NULL,
        plano       TEXT NOT NULL DEFAULT 'free',
        status      TEXT NOT NULL DEFAULT 'pendente',
        ativo       BOOLEAN DEFAULT true,
        criado_em   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS registros (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        produto_nome  TEXT NOT NULL,
        separacao     INTEGER DEFAULT 0,
        logistica     INTEGER DEFAULT 0,
        montagem      INTEGER DEFAULT 0,
        pintura       INTEGER DEFAULT 0,
        acabamento    INTEGER DEFAULT 0,
        parado        INTEGER DEFAULT 0,
        imprevistos   INTEGER DEFAULT 0,
        total_minutos INTEGER DEFAULT 0,
        observacao    TEXT,
        criado_em     TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_registros_criado  ON registros(criado_em);
    `);

    // Migração: adiciona coluna status se não existir (sem DEFAULT para pegar NULLs)
    await client.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status TEXT;
    `);

    // Migração: usuários antigos (sem status) ficam como 'ativo'
    await client.query(`
      UPDATE usuarios SET status = 'ativo' WHERE status IS NULL;
    `);

    // Garante NOT NULL e DEFAULT 'pendente' para novos usuários
    await client.query(`
      ALTER TABLE usuarios ALTER COLUMN status SET NOT NULL;
      ALTER TABLE usuarios ALTER COLUMN status SET DEFAULT 'pendente';
    `);

    console.log('✅ Banco de dados inicializado.');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
