// HUD: all DOM updates. The game sim never touches the DOM directly; main.js calls
// update() once per frame with a flat snapshot, and the one-shot helpers for events.
// Buy menu items are built once from the weapon/grenade tables, with a damage bar.
import { WEAPONS, GRENADES } from './weapons.js';

function el(id) {
  return document.getElementById(id);
}

export function createHud(onBuy) {
  const els = {
    timer: el('timer'),
    scoreV: el('score-v'),
    scoreS: el('score-s'),
    roundNum: el('round-num'),
    healthBar: el('health-bar'),
    healthNum: el('health-num'),
    armorBar: el('armor-bar'),
    armorNum: el('armor-num'),
    ammoMag: el('ammo-mag'),
    ammoReserve: el('ammo-reserve'),
    weaponName: el('weapon-name'),
    grenades: el('grenades'),
    killfeed: el('killfeed'),
    crosshair: el('crosshair'),
    hitmarker: el('hitmarker'),
    objective: el('objective'),
    announce: el('announce'),
    announceSub: el('announce-sub'),
    buyMenu: el('buy-menu'),
    buyItems: el('buy-items'),
    buyMoney: el('buy-money'),
    scoreboard: el('scoreboard'),
    scoreRows: el('scoreboard-rows'),
    vignette: el('damage-vignette'),
    startOverlay: el('start-overlay'),
    endOverlay: el('end-overlay'),
    endTitle: el('end-title'),
    endStats: el('end-stats'),
    plantBar: el('plant-progress'),
    defuseBar: el('defuse-progress'),
    bombTimer: el('bomb-timer'),
  };
  let announceTimer = null;
  let hitTimer = null;
  let vignetteTimer = null;

  const items = [];
  for (const w of WEAPONS) {
    if (w.price === 0) continue;
    const div = document.createElement('div');
    div.className = 'buy-item';
    const dmgPct = Math.min(100, Math.round((w.dmg * (w.pellets || 1)) / 120 * 100));
    div.innerHTML = `<b>${w.name}</b><span>${w.kind} — ${w.dmg} dmg · ${w.mag} rnd · ${w.auto ? 'AUTO' : 'SEMI'}</span><i>$${w.price}</i><span class="stat"><u style="width:${dmgPct}%"></u></span>`;
    div.addEventListener('click', () => onBuy('weapon', w.id));
    els.buyItems.appendChild(div);
    items.push(div);
  }
  for (const g of GRENADES) {
    const div = document.createElement('div');
    div.className = 'buy-item';
    div.innerHTML = `<b>${g.name}</b><span>${g.id === 'frag' ? 'explosive — clears a site' : 'blocks sight for 12s'} — max 2</span><i>$${g.price}</i>`;
    div.addEventListener('click', () => onBuy('grenade', g.id));
    els.buyItems.appendChild(div);
    items.push(div);
  }
  const armorDiv = document.createElement('div');
  armorDiv.className = 'buy-item';
  armorDiv.innerHTML = '<b>Kevlar Armour</b><span>100 armour — absorbs half of damage</span><i>$650</i>';
  armorDiv.addEventListener('click', () => onBuy('armor', 'armor'));
  els.buyItems.appendChild(armorDiv);
  items.push(armorDiv);

  function showAnnouncement(text, sub = '', ms = 2600) {
    els.announce.textContent = text;
    els.announceSub.textContent = sub;
    els.announce.classList.add('show');
    els.announceSub.classList.add('show');
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      els.announce.classList.remove('show');
      els.announceSub.classList.remove('show');
    }, ms);
  }
  function hideAnnouncement() {
    if (announceTimer) clearTimeout(announceTimer);
    els.announce.classList.remove('show');
    els.announceSub.classList.remove('show');
  }

  return {
    update(s) {
      els.timer.textContent = s.phase === 'buy' ? `BUY ${Math.ceil(s.phaseLeft)}` : `${Math.floor(s.roundLeft / 60)}:${String(Math.floor(s.roundLeft % 60)).padStart(2, '0')}`;
      els.scoreV.textContent = s.vanguardWins;
      els.scoreS.textContent = s.sentinelWins;
      els.roundNum.textContent = `ROUND ${s.round} / 15`;
      els.healthBar.style.width = `${s.health}%`;
      els.healthBar.className = s.health <= 25 ? 'low' : s.health <= 55 ? 'mid' : '';
      els.healthNum.textContent = `${Math.ceil(s.health)}`;
      els.healthNum.classList.toggle('low', s.health <= 25);
      els.armorBar.style.width = `${Math.min(100, s.armor)}%`;
      els.armorNum.textContent = s.armor > 0 ? `ARMOR ${Math.ceil(s.armor)}` : '';
      els.vignette.classList.toggle('lowhp', s.health <= 25 && s.health > 0);
      els.ammoMag.textContent = s.mag;
      els.ammoMag.classList.toggle('low', s.mag <= Math.max(2, Math.ceil(s.magMax * 0.2)));
      els.ammoReserve.textContent = ` / ${s.reserve}`;
      els.weaponName.textContent = s.weaponName;
      els.grenades.innerHTML = `FRAG <span class="pip">${'●'.repeat(s.frag)}${'○'.repeat(2 - s.frag)}</span> · SMOKE <span class="pip">${'●'.repeat(s.smoke)}${'○'.repeat(2 - s.smoke)}</span>`;
      els.objective.textContent = s.objective;
      els.bombTimer.textContent = s.bombFuse > 0 ? `BOMB ${s.bombFuse.toFixed(0)}s` : '';
      els.crosshair.style.setProperty('--spread', `${s.spread}px`);
      els.buyMoney.textContent = `$${s.money}`;
      els.buyMenu.classList.toggle('show', s.buyOpen);
      els.plantBar.style.width = `${s.plant * 100}%`;
      els.defuseBar.style.width = `${s.defuse * 100}%`;
      els.plantBar.parentElement.style.display = s.plant > 0 ? 'block' : 'none';
      els.defuseBar.parentElement.style.display = s.defuse > 0 ? 'block' : 'none';
    },
    showAnnouncement,
    hideAnnouncement,
    addKillFeed(text, good) {
      const div = document.createElement('div');
      div.className = good ? 'kf good' : 'kf';
      div.textContent = text;
      els.killfeed.prepend(div);
      while (els.killfeed.children.length > 5) els.killfeed.lastChild.remove();
      setTimeout(() => div.remove(), 6000);
    },
    hitmarker(kill) {
      els.hitmarker.classList.add('show');
      if (kill) els.hitmarker.classList.add('kill');
      if (hitTimer) clearTimeout(hitTimer);
      hitTimer = setTimeout(() => els.hitmarker.classList.remove('show', 'kill'), 140);
    },
    damageFlash() {
      els.vignette.classList.add('show');
      if (vignetteTimer) clearTimeout(vignetteTimer);
      vignetteTimer = setTimeout(() => els.vignette.classList.remove('show'), 180);
    },
    showScoreboard(rows) {
      els.scoreboard.classList.toggle('show', true);
      els.scoreRows.innerHTML = rows.map((r) => `<div class="sb-row ${r.team}"><span>${r.name}</span><span>${r.kills} / ${r.deaths}</span><span class="${r.alive ? '' : 'dead'}">${r.alive ? 'ALIVE' : 'DEAD'}</span></div>`).join('');
    },
    hideScoreboard() {
      els.scoreboard.classList.remove('show');
    },
    showStart() {
      els.startOverlay.classList.add('show');
      els.endOverlay.classList.remove('show');
    },
    hideStart() {
      els.startOverlay.classList.remove('show');
    },
    showMatchEnd(winner, stats) {
      els.endTitle.textContent = winner === 'vanguard' ? 'VANGUARD WINS THE MATCH' : 'SENTINEL WINS THE MATCH';
      els.endStats.innerHTML = `Rounds ${stats.vanguardWins} — ${stats.sentinelWins} · Kills ${stats.kills} · Deaths ${stats.deaths} · Plants ${stats.planted} · Defuses ${stats.defused}`;
      els.endOverlay.classList.add('show');
    },
    hideEnd() {
      els.endOverlay.classList.remove('show');
    },
  };
}
