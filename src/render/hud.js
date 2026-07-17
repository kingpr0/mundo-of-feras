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
      if (!v) $('cap').style.display = 'none';
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
    nomeInimigo(n) { $('nomeE').textContent = n; },
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
