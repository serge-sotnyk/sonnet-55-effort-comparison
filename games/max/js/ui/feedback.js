// Translates simulation events into sound, particles, banners and minimap pings.
import { UNITS } from '../data/units.js';
import { AGE_NAMES } from '../data/constants.js';

export class Feedback {
  constructor(S) { this.S = S; this.combatT = -99; this.fireT = 0; this.dustT = 0; this.lastBanner = 0; }

  get cam() { return this.S.cam; }

  /** Is world point (x,y) near the viewport? returns {pan, vol} or null */
  spatial(x, y, margin = 0.25) {
    const cam = this.cam;
    const s = cam.worldToScreen(x, y);
    const mx = cam.vw * margin, my = cam.vh * margin;
    if (s[0] < -mx || s[0] > cam.vw + mx || s[1] < -my || s[1] > cam.vh + my) return null;
    const pan = Math.max(-0.85, Math.min(0.85, (s[0] - cam.vw / 2) / (cam.vw / 2)));
    const out = Math.max(0, Math.abs(s[0] - cam.vw / 2) / cam.vw - 0.5) + Math.max(0, Math.abs(s[1] - cam.vh / 2) / cam.vh - 0.5);
    return { pan, vol: Math.max(0.25, 1 - out * 1.5) };
  }
  play(name, x, y, vol = 1, margin) {
    const a = this.S.audio; if (!a) return;
    const sp = this.spatial(x, y, margin);
    if (!sp) return;
    a.play(name, { pan: sp.pan, vol: sp.vol * vol });
  }

  process(events) {
    const S = this.S, g = S.game, fx = S.fx, me = g.humanIndex;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      switch (e.t) {
        case 'hit': {
          const k = e.kind;
          if (k === 'blade') { this.play('sword_hit', e.x, e.y, 0.9); fx.sparks(e.x, e.y, 2, '#ffd9a0', 16); }
          else if (k === 'clang') { this.play('sword_clang', e.x, e.y, 0.9); fx.sparks(e.x, e.y, 4, '#fff2c0', 16); }
          else if (k === 'stone') { this.play('ram_hit', e.x, e.y, 0.7); fx.debris(e.x, e.y, 2, 12, '#8c8576'); fx.dust(e.x, e.y, 1, 8, 8); }
          else if (k === 'wood') { this.play(e.atk === 'ram' || e.atk === 'capped_ram' || e.atk === 'siege_ram' ? 'ram_hit' : 'blunt_hit', e.x, e.y, 0.8); fx.chips(e.x, e.y, '#9a7a4a', 3); }
          else if (k === 'arrow') { this.play('arrow_hit', e.x, e.y, 0.7); fx.sparks(e.x, e.y, 1, '#ffd9a0', 14); }
          else if (k === 'arrow_wood') this.play('arrow_hit_wood', e.x, e.y, 0.6);
          this.combatT = g.time;
          if (e.owner === me || this.nearOwn(e.x, e.y)) this.combatMine = g.time;
          break;
        }
        case 'shoot': {
          const nm = e.type === 'arrow' ? 'arrow_shoot' : e.type === 'javelin' ? 'javelin' : e.type === 'axe' ? 'axe_throw' : e.type === 'bolt' ? 'bolt_shoot' : e.type === 'stone' ? 'catapult_fire' : e.type === 'bigstone' ? 'trebuchet_fire' : null;
          if (nm) this.play(nm, e.x, e.y, e.type === 'arrow' ? 0.55 : 0.9);
          if (e.type === 'stone' || e.type === 'bigstone') fx.dust(e.x, e.y, 3, 10, 6);
          break;
        }
        case 'impact': {
          this.play('stone_impact', e.x, e.y, 1);
          fx.debris(e.x, e.y, 9, 4, '#7a6a54'); fx.dust(e.x, e.y, 6, 14, 3);
          break;
        }
        case 'death': {
          const nm = e.animal ? 'animal_die' : e.villager ? 'villager_die' : e.cavalry ? 'horse_die' : e.siege ? 'building_collapse' : 'unit_die';
          this.play(nm, e.x, e.y, e.siege ? 0.5 : 0.85);
          if (e.siege) { fx.debris(e.x, e.y, 8, 6, '#7a5a34'); fx.dust(e.x, e.y, 5, 14, 3); } else fx.dust(e.x, e.y, 2, 6, 3);
          break;
        }
        case 'collapse': {
          const s = e.size;
          this.play('building_collapse', e.x, e.y, 1, 0.6);
          fx.debris(e.x, e.y, 10 + s * 6, 12, e.type === 'palisade' || e.type === 'house' ? '#8a6a3a' : '#8c8576');
          fx.dust(e.x, e.y, 8 + s * 4, 16 + s * 6, 6);
          if (!e.flat) for (let k = 0; k < 5 + s * 2; k++) fx.smoke(e.x + (Math.random() - 0.5) * s, e.y + (Math.random() - 0.5) * s, 12 + Math.random() * 20, 1.2, 0.4);
          break;
        }
        case 'built': if (e.owner === me) { this.play('building_complete', e.x, e.y, 0.9); fx.dust(e.x, e.y, 6, 12, 4); } break;
        case 'hammer': this.play('hammer', e.x, e.y, 0.7); fx.chips(e.x, e.y, '#c9a66a', 2); break;
        case 'drop': if (e.owner === me) {
          const nm = e.res === 'wood' ? 'drop_wood' : e.res === 'gold' ? 'drop_gold' : e.res === 'stone' ? 'drop_stone' : 'drop_food';
          this.play(nm, e.x, e.y, 0.55);
          const col = { wood: '#c9a066', food: '#ff9a6a', gold: '#ffd84a', stone: '#c8c8c8' }[e.res];
          if (this.spatial(e.x, e.y, 0)) fx.text(e.x, e.y, '+' + Math.round(e.amt), col, 34);
        } break;
        case 'trained': if (e.owner === me) this.S.audio && this.S.audio.play('unit_trained', { vol: 0.7 }); break;
        case 'researched': if (e.owner === me) this.S.audio && this.S.audio.play('research_done'); break;
        case 'ageup': {
          if (e.owner === me) {
            this.S.audio && this.S.audio.play('age_up'); this.S.audio && this.S.audio.duck && this.S.audio.duck(0.4, 6);
            this.S.hud.banner(AGE_NAMES[e.age], 'You have advanced');
            if (e.x) { fx.ring(e.x, e.y, '#ffe27a', 90, 1.4); fx.glow(e.x, e.y, 30, '#ffd84a', 120, 1.6); }
          }
          break;
        }
        case 'alert': {
          this.S.input.lastAlert = { x: e.x, y: e.y };
          this.S.minimap && this.S.minimap.ping(e.x, e.y, '#ff4a3a');
          if (g.time - (this.lastAlertSnd || -99) > 8) { this.lastAlertSnd = g.time; this.S.audio && this.S.audio.play(e.building ? 'alarm_building' : 'alarm_attack'); }
          this.combatMine = g.time;
          break;
        }
        case 'convert_start': this.play('monk_convert', e.x, e.y, 0.9); break;
        case 'convert': {
          fx.glow(e.x, e.y, 24, '#ffe9a0', 60, 1.0); fx.ring(e.x, e.y, '#ffe9a0', 40, 1.0);
          this.play('monk_convert_done', e.x, e.y, 1);
          if (e.to === me) g.notify(me, 'A unit has been converted to your side!', e.x, e.y, 'good');
          else if (e.from === me) g.notify(me, 'One of your units was converted!', e.x, e.y, 'alert');
          break;
        }
        case 'heal': fx.glow(e.x, e.y, 22, '#9dffb0', 26, 0.7); this.play('monk_heal', e.x, e.y, 0.5); break;
        case 'garrison': this.play('garrison', e.x, e.y, 0.6); break;
        case 'trade': break;
        case 'resdepleted': if (e.sub === 'tree') { this.play('tree_fall', e.x, e.y, 0.7); fx.dust(e.x, e.y, 3, 10, 8); } break;
        case 'reseed': break;
        case 'wonder_start': this.S.audio && this.S.audio.play('wonder_start'); break;
        case 'defeat': {
          const p = g.players[e.player];
          if (p && e.player !== me) g.notify(me, `${p.name} has been defeated!`, 0, 0, 'good');
          break;
        }
        case 'gameover': this.S.onGameOver(e); break;
      }
    }
    events.length = 0;
  }

  nearOwn(x, y) {
    const g = this.S.game;
    const near = g.queryUnits(x, y, 6);
    for (const u of near) if (u.owner === g.humanIndex) return true;
    return false;
  }

  // ---- renderer hooks
  workHit(u, anim) {
    const fx = this.S.fx;
    if (Math.random() > 0.55) return;
    const dirx = Math.cos(u.dir * Math.PI / 4) * 0.6, diry = Math.sin(u.dir * Math.PI / 4) * 0.6;
    if (anim === 'chop') { this.play('chop', u.x + dirx, u.y + diry, 0.5); fx.chips(u.x + dirx, u.y + diry, '#b88a52', 2); }
    else if (anim === 'mine') { this.play('mine', u.x + dirx, u.y + diry, 0.5); fx.sparks(u.x + dirx, u.y + diry, 2, '#ffe6a0', 10); }
    else if (anim === 'farm') this.play('farm', u.x, u.y, 0.3);
    else if (anim === 'forage') this.play('forage', u.x, u.y, 0.3);
    else if (anim === 'butcher') this.play('butcher', u.x, u.y, 0.4);
  }

  buildingVisible(b, sx, sy, sp) {
    const fx = this.S.fx, dt = this.S.dtReal || 0.016;
    if (b.built && b.hp < b.maxHp * 0.6 && !b.def.wall) {
      const sev = 1 - b.hp / (b.maxHp * 0.6);        // 0..1
      const h = sp ? sp.ay : 60;
      if (Math.random() < dt * (3 + sev * 12) * Math.min(2, b.size * 0.6)) {
        fx.flame(b.x + (Math.random() - 0.5) * b.size * 0.8, b.y + (Math.random() - 0.5) * b.size * 0.8, 14 + Math.random() * Math.min(70, h * 0.55), 0.7 + sev * 0.6);
      }
      if (Math.random() < dt * (2 + sev * 6)) fx.smoke(b.x + (Math.random() - 0.5) * b.size * 0.6, b.y + (Math.random() - 0.5) * b.size * 0.6, 30 + Math.random() * Math.min(60, h * 0.6), 0.9 + sev, 0.5 + sev * 0.4);
    }
    if (!b.built && b.nBuilders > 0 && Math.random() < dt * 3) fx.dust(b.x + (Math.random() - 0.5) * b.size, b.y + (Math.random() - 0.5) * b.size, 1, 7, 3);
  }

  /** choose music mood from the situation */
  updateMood(dt) {
    const a = this.S.audio; if (!a || !a.music) return;
    const g = this.S.game;
    const mood = (g.time - (this.combatMine || -99) < 14) ? 'battle' : (g.time - this.combatT < 20 ? 'tense' : 'peace');
    if (mood !== this._mood) { this._mood = mood; a.music.setMood(mood); }
  }
}
