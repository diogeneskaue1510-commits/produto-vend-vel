// patch.js — Rode com: node patch.js
// Modifica o index.html para suportar aprovação de usuários

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'public', 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

// ── Substituição 1: doLogin ──
const oldLogin = `async function doLogin(){
  const email=document.getElementById('lEmail').value.trim();
  const senha=document.getElementById('lSenha').value;
  if(!email||!senha){showMsg('Preencha todos os campos.','err');return;}
  loading(true);
  try{
    const r=await fetch(\`\${API}/auth/login\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,senha})});
    const d=await r.json();
    if(!r.ok){showMsg(d.erro,'err');return;}
    saveAuth(d.token,d.usuario); mostrarApp();
  }catch{showMsg('Erro de conexão. Servidor rodando?','err');}
  finally{loading(false);}
}`;

const newLogin = `async function doLogin(){
  const email=document.getElementById('lEmail').value.trim();
  const senha=document.getElementById('lSenha').value;
  if(!email||!senha){showMsg('Preencha todos os campos.','err');return;}
  loading(true);
  try{
    const r=await fetch(\`\${API}/auth/login\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,senha})});
    const d=await r.json();
    if(!r.ok){
      if(d.erro==='pendente'){showMsg('⏳ Sua conta está aguardando aprovação do administrador. Você receberá acesso em breve.','err');}
      else if(d.erro==='bloqueado'){showMsg('🚫 Sua conta foi bloqueada. Entre em contato com o suporte.','err');}
      else{showMsg(d.erro,'err');}
      return;
    }
    saveAuth(d.token,d.usuario); mostrarApp();
  }catch{showMsg('Erro de conexão. Servidor rodando?','err');}
  finally{loading(false);}
}`;

// ── Substituição 2: doCad ──
const oldCad = `async function doCad(){
  const nome=document.getElementById('cNome').value.trim();
  const email=document.getElementById('cEmail').value.trim();
  const senha=document.getElementById('cSenha').value;
  if(!nome||!email||!senha){showMsg('Preencha todos os campos.','err');return;}
  loading(true);
  try{
    const r=await fetch(\`\${API}/auth/cadastro\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome,email,senha})});
    const d=await r.json();
    if(!r.ok){showMsg(d.erro,'err');return;}
    saveAuth(d.token,d.usuario); mostrarApp(); toast('Conta criada! Bem-vindo(a) 🎉','ok');
  }catch{showMsg('Erro de conexão.','err');}
  finally{loading(false);}
}`;

const newCad = `async function doCad(){
  const nome=document.getElementById('cNome').value.trim();
  const email=document.getElementById('cEmail').value.trim();
  const senha=document.getElementById('cSenha').value;
  if(!nome||!email||!senha){showMsg('Preencha todos os campos.','err');return;}
  loading(true);
  try{
    const r=await fetch(\`\${API}/auth/cadastro\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome,email,senha})});
    const d=await r.json();
    if(!r.ok){showMsg(d.erro,'err');return;}
    showMsg('✅ Cadastro realizado! Aguarde a aprovação do administrador para acessar o sistema.','ok');
    document.getElementById('cNome').value='';
    document.getElementById('cEmail').value='';
    document.getElementById('cSenha').value='';
  }catch{showMsg('Erro de conexão.','err');}
  finally{loading(false);}
}`;

let changed = 0;
if (content.includes(oldLogin)) { content = content.replace(oldLogin, newLogin); changed++; console.log('✅ doLogin atualizado'); }
else { console.log('⚠️  doLogin não encontrado (pode já estar atualizado)'); }

if (content.includes(oldCad)) { content = content.replace(oldCad, newCad); changed++; console.log('✅ doCad atualizado'); }
else { console.log('⚠️  doCad não encontrado (pode já estar atualizado)'); }

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Patch aplicado! (${changed} substituições)`);
