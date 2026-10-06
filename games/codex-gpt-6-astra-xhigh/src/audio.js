export class AudioEngine {
  constructor(){this.muted=localStorage.getItem('crown-muted')==='true';this.ctx=null;this.last=0;}
  unlock(){if(this.muted)return;try{this.ctx ||= new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{}}
  toggle(){this.muted=!this.muted;localStorage.setItem('crown-muted',String(this.muted));if(!this.muted)this.unlock();return this.muted;}
  play(type){if(this.muted||!this.ctx)return;const now=this.ctx.currentTime;if(now-this.last<.075)return;this.last=now;
    const melody=type==='age'?[261.63,329.63,392,523.25]:type==='end'?[261.63,392,523.25,659.25,783.99]:type==='attack'?[164.81,164.81,130.81]:type==='error'?[146.83,123.47]:type==='select'?[392]:type==='trained'||type==='success'?[329.63,440]:[293.66,392];
    melody.forEach((frequency,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=now+i*.105;o.type=type==='attack'?'triangle':'sine';o.frequency.value=frequency;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.028,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+.24);});
  }
}
