// HUD — camada DOM: barras de vida, toasts, números de dano, título.
export function criarHUD() {
  const $ = (id) => document.getElementById(id);
  let toastT = null;
  const dmgs = [];
  return {
    toast(txt, dur = 2600) {
      const t = $('toast'); t.textContent = txt; t.style.display = 'block';
      clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', dur);
    },
    flash() {
      const f = $('flash'); f.style.opacity = 0.85;
      setTimeout(() => f.style.opacity = 0, 130);
    },
    batalhaVisivel(v) {
      $('hpP').style.display = v ? 'block' : 'none';
      $('hpE').style.display = v ? 'block' : 'none';
      $('golpesHud').style.display = v ? 'block' : 'none';
      if (!v) $('cap').style.display = 'none';
    },
    // painel de golpes da luta: tecla, nome e usos restantes (até 6 linhas)
    golpesPainel(linhas) {
      const box = $('golpesHud');
      box.innerHTML = '';
      for (const l of linhas.slice(0, 6)) {
        const d = document.createElement('div');
        d.className = 'glinha';
        d.innerHTML = `<span class="gtecla">${l.tecla}</span> ${l.nome} <span class="gusos">${l.usos}</span>`;
        box.appendChild(d);
      }
    },
    painelVida(hp, max) { $('pVida').textContent = `${hp}/${max}`; },
    // painel e minimapa só fazem sentido na exploração
    exploracaoVisivel(v) {
      $('painel').style.display = v ? 'block' : 'none';
      $('miniWrap').style.display = v ? 'block' : 'none';
    },
    localAtual(nome) {
      $('pMapa').textContent = nome;
      $('miniNome').textContent = nome;
    },
    miniMapa(mundo) {
      const cv = $('mini'), ctx = cv.getContext('2d');
      const mapa = mundo.mapa, L = mapa.limite;
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      const esc = Math.min((W - 14) / (L.x * 2), (H - 14) / (L.z * 2));
      const X = (x) => W / 2 + x * esc, Z = (z) => H / 2 + z * esc;
      ctx.fillStyle = '#3c6b33';
      ctx.fillRect(X(-L.x), Z(-L.z), L.x * 2 * esc, L.z * 2 * esc);
      ctx.fillStyle = '#63b04f';
      for (const G of mapa.gramas || (mapa.grama ? [mapa.grama] : []))
        ctx.fillRect(X(G.x0), Z(G.z0), (G.x1 - G.x0) * esc, (G.z1 - G.z0) * esc);
      ctx.fillStyle = '#b08a5a';
      for (const c of mapa.caminhos || [])
        ctx.fillRect(X(c.x0), Z(c.z0), (c.x1 - c.x0) * esc, (c.z1 - c.z0) * esc);
      ctx.fillStyle = '#8d939c';
      for (const [px2, pz2] of mapa.pedras || [])
        ctx.fillRect(X(px2) - 2, Z(pz2) - 2, 4, 4);
      if (mapa.agua) {
        const a = mapa.agua;
        ctx.fillStyle = '#3f8fd4';
        ctx.fillRect(X(a.x0), Z(a.z0), (a.x1 - a.x0) * esc, (a.z1 - a.z0) * esc);
      }
      ctx.fillStyle = '#8a7a52';
      for (const p of mapa.platos || [])
        ctx.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * esc, (p.z1 - p.z0) * esc);
      ctx.fillStyle = '#2a5226';
      for (const [ax, az] of mapa.arvores || []) ctx.fillRect(X(ax) - 1.5, Z(az) - 1.5, 3, 3);
      ctx.fillStyle = '#c96a3f';
      for (const [cx2, cz] of mapa.casas || []) ctx.fillRect(X(cx2) - 3, Z(cz) - 3, 6, 6);
      if (mapa.caverna) {
        ctx.fillStyle = '#16121f';
        ctx.beginPath();
        ctx.arc(X(mapa.caverna.x), Z(mapa.caverna.z), 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // passagens em amarelo na borda
      ctx.fillStyle = '#ffd23f';
      for (const s of mapa.saidas || []) {
        const m = (s.de + s.ate) / 2;
        if (s.borda === 'leste') ctx.fillRect(X(L.x) - 2, Z(m) - 4, 4, 8);
        if (s.borda === 'oeste') ctx.fillRect(X(-L.x) - 2, Z(m) - 4, 4, 8);
        if (s.borda === 'sul') ctx.fillRect(X(m) - 4, Z(L.z) - 2, 8, 4);
        if (s.borda === 'norte') ctx.fillRect(X(m) - 4, Z(-L.z) - 2, 8, 4);
      }
      // o domador
      const p = mundo.domador.pos;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e05a41';
      ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 2.6, 0, Math.PI * 2); ctx.fill();
    },
    // mapa-região estilo Pokémon: cada área é um nó ligado por linhas
    mapaRegiao(dadosMapas, chaveAtual) {
      const cv = $('regiao'), ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      const nos = Object.entries(dadosMapas.mapas).filter(([, m]) => m.regiao);
      if (!nos.length) return;
      const xs = nos.map(([, m]) => m.regiao.x), ys = nos.map(([, m]) => m.regiao.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const passo = Math.min((cv.width - 28) / Math.max(1, maxX - minX),
                             (cv.height - 28) / Math.max(1, maxY - minY), 34);
      const PX = (m) => 14 + (m.regiao.x - minX) * passo + (cv.width - 28 - (maxX - minX) * passo) / 2;
      const PY = (m) => 14 + (m.regiao.y - minY) * passo + (cv.height - 28 - (maxY - minY) * passo) / 2;
      // ligações
      ctx.strokeStyle = '#6b6483'; ctx.lineWidth = 2;
      for (const [chave, m] of nos) {
        for (const s of m.saidas || []) {
          const d = dadosMapas.mapas[s.destino];
          if (!d || !d.regiao) continue;
          ctx.beginPath(); ctx.moveTo(PX(m), PY(m)); ctx.lineTo(PX(d), PY(d)); ctx.stroke();
        }
      }
      // nós (o atual em amarelo, pulsando um pouco maior)
      for (const [chave, m] of nos) {
        const atual = chave === chaveAtual;
        ctx.fillStyle = atual ? '#ffd23f' : (m.agua ? '#3f8fd4' : m.borda === 'montanha' ? '#8d939c' : '#63b04f');
        const r = atual ? 6 : 4.5;
        ctx.fillRect(PX(m) - r, PY(m) - r, r * 2, r * 2);
        if (atual) { ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 1.5; ctx.strokeRect(PX(m) - r, PY(m) - r, r * 2, r * 2); }
      }
    },
    atualizaHP(b) {
      const cor = (f) => { const r = f.hp / f.max;
        return r > .5 ? '#6fe06a' : r > .25 ? '#ffd23f' : '#ff5a4a'; };
      $('fillP').style.width = (b.p.hp / b.p.max * 100) + '%';
      $('fillE').style.width = (b.e.hp / b.e.max * 100) + '%';
      $('fillP').style.background = cor(b.p);
      $('fillE').style.background = cor(b.e);
    },
    capDisponivel(v) { $('cap').style.display = v ? 'block' : 'none'; },
    nomeInimigo(n, nivel) { $('nomeE').textContent = n + (nivel ? ` Lv.${nivel}` : ''); },
    nomeJogador(n, nivel) {
      $('nomeP').textContent = '♦ ' + n + (nivel ? ` Lv.${nivel}` : '');
      $('pAtiva').textContent = n + (nivel ? ` · Lv.${nivel}` : '');
    },
    // barra de evolução (XP) sob a barra de vida do jogador
    xp(fracao) { $('fillXp').style.width = Math.min(100, fracao * 100) + '%'; },
    dica(txt) { $('dica').textContent = txt; },
    // menu genérico (exploração e batalha): título + lista com seleção
    menu(v, titulo = '', itens = [], sel = 0) {
      const m = $('menu');
      m.style.display = v ? 'block' : 'none';
      if (!v) return;
      $('menuTit').textContent = titulo;
      const lista = $('menuItens');
      lista.innerHTML = '';
      itens.forEach((txt, i) => {
        const d = document.createElement('div');
        d.className = 'opt' + (i === sel ? ' sel' : '');
        d.textContent = txt;
        lista.appendChild(d);
      });
    },
    escolha(v, sel = 0) {
      $('escolha').style.display = v ? 'flex' : 'none';
      if (v) {
        $('optLutar').className = 'opt' + (sel === 0 ? ' sel' : '');
        $('optFugir').className = 'opt' + (sel === 1 ? ' sel' : '');
      }
    },
    equipe(n) { $('nCap').textContent = n; },
    escondeTitulo() { $('titulo').style.display = 'none'; },
    dano(pos, valor, forte) {
      const d = document.createElement('div');
      d.className = 'dmg' + (forte ? ' forte' : '');
      d.textContent = valor;
      $('hud').appendChild(d);
      dmgs.push({ pos: { ...pos, y: pos.y + 2 }, el: d, vida: 0.85 });
    },
    passoDanos(camera, dt, THREE_) {
      for (let i = dmgs.length - 1; i >= 0; i--) {
        const d = dmgs[i];
        d.vida -= dt; d.pos.y += 1.4 * dt;
        const v = new THREE_.Vector3(d.pos.x, d.pos.y, d.pos.z).project(camera);
        d.el.style.left = ((v.x * .5 + .5) * innerWidth - 10) + 'px';
        d.el.style.top = ((-v.y * .5 + .5) * innerHeight - 10) + 'px';
        d.el.style.opacity = Math.min(1, d.vida * 2.5);
        if (d.vida <= 0) { d.el.remove(); dmgs.splice(i, 1); }
      }
    },
  };
}
