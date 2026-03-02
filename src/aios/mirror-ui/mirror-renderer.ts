const PHI    = 1.6180339887;
const PI_EXT = Math.PI * 1.0159;

import {
  MirrorConfig, MirrorCursorState, MirrorActionEvent,
  MirrorMode, DEFAULT_MIRROR_CONFIG,
} from './types';

export class MirrorRenderer {
  private canvas:  HTMLCanvasElement;
  private ctx:     CanvasRenderingContext2D;
  private config:  MirrorConfig = { ...DEFAULT_MIRROR_CONFIG };
  private cursors: MirrorCursorState[] = [];
  private actions: MirrorActionEvent[] = [];
  private rafId:   number | null = null;
  private phase  = 0;
  private overlayScroll = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d')!;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  updateConfig(cfg: Partial<MirrorConfig>): void { Object.assign(this.config, cfg); }
  updateCursors(c: MirrorCursorState[]): void    { this.cursors = c; }
  pushAction(e: MirrorActionEvent): void {
    this.actions.unshift(e);
    if (this.actions.length > 30) this.actions.pop();
  }

  start(): void {
    if (this.rafId !== null) return;
    const loop = (ts: number) => {
      this.phase = ts * 0.001;
      this.overlayScroll = (this.phase * 20) % 200;
      this._draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  private _draw(): void {
    const { width: W, height: H } = this.canvas;
    const mainW = this.config.showActionFeed ? W * 0.68 : W;
    this.ctx.clearRect(0, 0, W, H);
    this._drawBg(W, H);
    this.ctx.save();
    this.ctx.beginPath(); this.ctx.rect(0, 0, mainW, H); this.ctx.clip();
    this._drawMirrorArea(mainW, H);
    this.ctx.restore();
    if (this.config.showActionFeed)  this._drawFeed(mainW, W, H);
    if (this.config.showDFUMTOverlay) this._drawOverlay(mainW, H);
    this._drawChrome(W, H, mainW);
  }

  private _drawBg(W: number, H: number): void {
    const ctx = this.ctx;
    const bg = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.8);
    bg.addColorStop(0,'#0c0c16'); bg.addColorStop(1,'#06060b');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(110,158,207,0.04)'; ctx.lineWidth=0.5;
    for(let x=0;x<=W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<=H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  }

  private _drawMirrorArea(W: number, H: number): void {
    if (!this.cursors.length) { this._drawIdle(W,H); return; }
    const depth = this.config.depth;
    for (let d = depth; d >= 1; d--) {
      const op = this.config.reflectionOpacityBase
        * Math.pow(this.config.reflectionOpacityDecay, d-1);
      this.ctx.save(); this.ctx.globalAlpha = op;
      this._drawAtDepth(d, W, H);
      this.ctx.restore();
    }
    if (this.config.showDepthLines) this._drawBorders(depth, W, H);
  }

  private _transform(mode: MirrorMode, W: number, H: number,
                     shrink: number, ox: number, oy: number, depth: number) {
    const fw=W*shrink, fh=H*shrink;
    if (mode==='horizontal')
      return (sx:number,sy:number)=>({tx:ox+fw-(sx-ox), ty:oy+(sy-oy)*shrink+oy*(1-shrink)});
    if (mode==='vertical')
      return (sx:number,sy:number)=>({tx:ox+(sx-ox)*shrink+ox*(1-shrink), ty:oy+fh-(sy-oy)});
    if (mode==='radial')
      return (sx:number,sy:number)=>({tx:ox+fw-sx*shrink, ty:oy+fh-sy*shrink});
    // dimensional
    const angle = depth*(PI_EXT/PHI);
    const cos=Math.cos(angle), sin=Math.sin(angle);
    const cx=W/2, cy=H/2, ps=Math.pow(1/PHI, depth-1);
    return (sx:number,sy:number)=>{
      const dx=(sx-cx)*shrink, dy=(sy-cy)*shrink;
      return { tx: cx+(dx*cos-dy*sin)*ps, ty: cy+(dx*sin+dy*cos)*ps };
    };
  }

  private _drawAtDepth(d: number, W: number, H: number): void {
    const shrink=Math.pow(0.7,d-1);
    const fw=W*shrink, fh=H*shrink, ox=(W-fw)/2, oy=(H-fh)/2;
    const tf = this._transform(this.config.mode, W, H, shrink, ox, oy, d);
    const sw = window.screen?.width||W, sh = window.screen?.height||H;
    const ctx = this.ctx;
    for (const cur of this.cursors) {
      if (!cur.visible) continue;
      const {tx,ty} = tf((cur.x/sw)*W, (cur.y/sh)*H);
      if (tx<0||tx>W||ty<0||ty>H) continue;
      if (cur.trail?.length>1) {
        ctx.beginPath(); ctx.strokeStyle=cur.color+'60';
        ctx.lineWidth=Math.max(0.5,2*shrink);
        const f0=tf((cur.trail[0].x/sw)*W,(cur.trail[0].y/sh)*H);
        ctx.moveTo(f0.tx,f0.ty);
        for(const pt of cur.trail.slice(1)){
          const t=tf((pt.x/sw)*W,(pt.y/sh)*H); ctx.lineTo(t.tx,t.ty);
        }
        ctx.stroke();
      }
      this._drawShape(tx,ty,Math.max(4,18*shrink),cur,d);
      if (d===1&&cur.label) {
        ctx.font=`${Math.max(8,11*shrink)}px JetBrains Mono,monospace`;
        ctx.fillStyle=cur.color;
        ctx.globalAlpha*=0.85;
        ctx.fillText(cur.label,tx+Math.max(4,18*shrink)/2+4,ty-4);
        ctx.globalAlpha/=0.85;
      }
    }
  }

  private _drawShape(x:number,y:number,size:number,cur:MirrorCursorState,d:number):void{
    const ctx=this.ctx, s=size/2, c=cur.color;
    const pulse=1+Math.sin(this.phase*3)*0.12;
    const ds=s*(cur.state==='thinking'?pulse:1);
    ctx.strokeStyle=c; ctx.fillStyle=c+'20';
    ctx.lineWidth=Math.max(0.5,1.5-d*0.2);
    if(cur.type==='rei'){
      ctx.beginPath();
      for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2-Math.PI/6+this.phase*0.5;
        ctx[i===0?'moveTo':'lineTo'](x+Math.cos(a)*ds,y+Math.sin(a)*ds);}
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,ds*0.3,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();
    } else if(cur.type==='dfumt'){
      ctx.beginPath();ctx.arc(x,y,ds,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,ds*0.45,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-ds,y);ctx.lineTo(x+ds,y);
      ctx.moveTo(x,y-ds);ctx.lineTo(x,y+ds);
      ctx.globalAlpha*=0.5;ctx.stroke();ctx.globalAlpha/=0.5;
    } else if(cur.type==='agent'){
      ctx.beginPath();ctx.moveTo(x,y-ds);ctx.lineTo(x+ds,y);
      ctx.lineTo(x,y+ds);ctx.lineTo(x-ds,y);ctx.closePath();
      ctx.fill();ctx.stroke();
    } else {
      ctx.beginPath();ctx.moveTo(x-s,y-s);ctx.lineTo(x+s*0.6,y);ctx.lineTo(x-s,y+s);
      ctx.closePath();ctx.fill();ctx.stroke();
    }
  }

  private _drawBorders(depth:number,W:number,H:number):void{
    const ctx=this.ctx;
    for(let d=1;d<=depth;d++){
      const sh=Math.pow(0.7,d-1),fw=W*sh,fh=H*sh,fx=(W-fw)/2,fy=(H-fh)/2;
      const t=(d-1)/Math.max(depth-1,1);
      const r=Math.round(110+(155-110)*t),g=Math.round(158+(126-158)*t);
      ctx.strokeStyle=`rgba(${r},${g},207,${0.4-d*0.06})`;
      ctx.lineWidth=Math.max(0.3,1.5-d*0.25);
      ctx.strokeRect(fx,fy,fw,fh);
      const cr=12*sh;
      ctx.strokeStyle=`rgba(${r},${g},207,${0.7-d*0.1})`;
      ctx.lineWidth=Math.max(0.5,2-d*0.3);
      for(const[cx,cy,dx,dy] of [[fx,fy,1,1],[fx+fw,fy,-1,1],[fx,fy+fh,1,-1],[fx+fw,fy+fh,-1,-1]] as [number,number,number,number][]){
        ctx.beginPath();ctx.moveTo(cx+dx*cr,cy);ctx.lineTo(cx,cy);ctx.lineTo(cx,cy+dy*cr);ctx.stroke();
      }
    }
  }

  private _drawIdle(W:number,H:number):void{
    const ctx=this.ctx, t=(Math.sin(this.phase*0.8)+1)/2;
    ctx.font='13px JetBrains Mono,monospace';
    ctx.fillStyle=`rgba(122,122,144,${0.3+t*0.3})`;
    ctx.textAlign='center';
    ctx.fillText('— 合わせ鏡 待機中 —',W/2,H/2-20);
    ctx.font='11px JetBrains Mono,monospace';
    ctx.fillStyle=`rgba(74,74,90,${0.3+t*0.2})`;
    ctx.fillText('MirrorUI.open() で接続',W/2,H/2+8);
    ctx.textAlign='left';
    ctx.strokeStyle=`rgba(110,158,207,${0.12+t*0.08})`;ctx.lineWidth=0.8;
    ctx.beginPath();
    for(let i=0;i<180;i++){
      const a=(i/30)*Math.PI*2+this.phase*0.3,r=Math.pow(PHI,i/60)*6;
      const px=W/2+Math.cos(a)*r,py=H/2+Math.sin(a)*r;
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.stroke();
  }

  private _drawFeed(x0:number,W:number,H:number):void{
    const ctx=this.ctx;
    ctx.strokeStyle='rgba(160,160,200,0.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x0,0);ctx.lineTo(x0,H);ctx.stroke();
    ctx.font='11px JetBrains Mono,monospace';
    ctx.fillStyle='rgba(122,122,144,0.7)';
    ctx.fillText('ACTION FEED',x0+12,22);
    ctx.strokeStyle='rgba(160,160,200,0.08)';
    ctx.beginPath();ctx.moveTo(x0+8,30);ctx.lineTo(W-8,30);ctx.stroke();
    const lh=40,sy=50;
    this.actions.slice(0,Math.floor((H-sy)/lh)).forEach((ev,i)=>{
      const y=sy+i*lh,age=(Date.now()-ev.timestamp)/1000,fade=Math.max(0.2,1-age/8);
      const c=ev.agentId?.includes('rei')?'#6e9ecf':ev.agentId?.includes('dfumt')?'#9b7ecf':'#c4a85a';
      ctx.beginPath();ctx.arc(x0+20,y+4,4,0,Math.PI*2);
      ctx.fillStyle=c+Math.round(fade*255).toString(16).padStart(2,'0');ctx.fill();
      ctx.font='10px JetBrains Mono,monospace';
      ctx.fillStyle=c+Math.round(fade*200).toString(16).padStart(2,'0');
      ctx.fillText((ev.agentId||'').slice(0,12),x0+30,y);
      ctx.font='11px Zen Kaku Gothic New,sans-serif';
      ctx.fillStyle=`rgba(160,160,192,${fade*0.9})`;
      ctx.fillText((ev.label||'').slice(0,22),x0+30,y+14);
      ctx.font='9px JetBrains Mono,monospace';
      ctx.fillStyle=`rgba(74,74,90,${fade*0.8})`;
      ctx.fillText(`${age.toFixed(1)}s ago`,x0+30,y+26);
    });
    if(!this.actions.length){
      ctx.font='10px JetBrains Mono,monospace';
      ctx.fillStyle='rgba(74,74,90,0.5)';
      ctx.fillText('イベント待機中...',x0+12,60);
    }
  }

  private _drawOverlay(W:number,H:number):void{
    const F=['∀x: f(x)⊕f*(x)=0','φ=1.618…','π̂=π×1.0159…','Σφ⁻ⁿ=φ','D-FUMT写像∘写像⁻¹≡ε','limₙ Tⁿ(x)','⊕⊖種層展開','Rei::∞'];
    const step=200,cols=Math.ceil(W/step)+1,off=this.overlayScroll%step;
    this.ctx.font='9px JetBrains Mono,monospace';
    this.ctx.fillStyle='rgba(155,126,207,0.06)';
    for(let c=0;c<cols;c++) this.ctx.fillText(F[c%F.length],c*step-off+8,H-12);
  }

  private _drawChrome(W:number,H:number,mainW:number):void{
    const ctx=this.ctx;
    ctx.font='10px JetBrains Mono,monospace';
    ctx.fillStyle='rgba(122,122,144,0.6)';
    ctx.fillText(`合わせ鏡  mode:${this.config.mode}  depth:${this.config.depth}`,12,16);
    const active=this.cursors.filter(c=>c.visible).length;
    ctx.fillStyle=active>0?'rgba(110,158,207,0.5)':'rgba(74,74,90,0.4)';
    ctx.fillText(`agents:${active}`,12,H-10);
    ctx.fillStyle='rgba(155,126,207,0.35)';ctx.textAlign='right';
    ctx.fillText('D-FUMT',mainW-12,H-10);ctx.textAlign='left';
  }

  private _resize():void{
    this.canvas.width =this.canvas.clientWidth ||window.innerWidth;
    this.canvas.height=this.canvas.clientHeight||window.innerHeight;
  }

  destroy():void{ this.stop(); }
}
