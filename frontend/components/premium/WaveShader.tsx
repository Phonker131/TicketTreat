"use client";
import {useEffect,useRef} from "react";

/** Slow light waves rising from the bottom, drawn with WebGL in the brand colours.
 *  No library. Pauses off screen, keeps one still frame when Reduce Motion is on,
 *  and falls back to a CSS glow when WebGL is not available. */
/* Smooth sums of sines only: hash-based value noise showed rectangular steps on some GPUs. */
const FRAG=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;uniform float u_time;uniform vec3 u_bg;uniform vec3 u_c1;uniform vec3 u_c2;
void main(){
 vec2 uv=gl_FragCoord.xy/u_res;float asp=u_res.x/u_res.y;float x=uv.x*asp;
 float t=u_time*.05;float line=0.;float glow=0.;
 for(int i=0;i<4;i++){float fi=float(i);
  float y=.14+.075*fi
   +.045*sin(x*1.3+t*2.4+fi*2.1)
   +.028*sin(x*2.7-t*1.9+fi*1.3)
   +.014*sin(x*5.3+t*3.3+fi*.7);
  float d=uv.y-y;
  line+=exp(-d*d*2600.)*(.7-.14*fi);
  glow+=exp(-abs(d)*9.)*(.26-.05*fi);}
 float haze=smoothstep(.7,0.,uv.y)*(.18+.04*sin(x*1.1+t*1.6));
 vec3 col=mix(u_bg,u_c2,clamp(haze+glow*.55,0.,.85));
 col=mix(col,u_c1,clamp(glow*.75+line,0.,.9));
 gl_FragColor=vec4(col,1.);
}`;
const VERT=`attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

function hex(c:string):[number,number,number]{const v=c.replace("#","");return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255) as [number,number,number];}
const THEMES={
 dark:{bg:"#02070A",c1:"#FC734D",c2:"#0B3A52"},
 light:{bg:"#F0EBE1",c1:"#F9A88F",c2:"#A9D8F0"},
};

export function WaveShader({className=""}:{className?:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const gl=canvas.getContext("webgl",{antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:"low-power"});
  if(!gl){canvas.dataset.fallback="1";return;}
  const sh=(type:number,src:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);return s;};
  const prog=gl.createProgram()!;
  gl.attachShader(prog,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){canvas.dataset.fallback="1";return;}
  gl.useProgram(prog);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,"a");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const uRes=gl.getUniformLocation(prog,"u_res"),uTime=gl.getUniformLocation(prog,"u_time");
  const uBg=gl.getUniformLocation(prog,"u_bg"),uC1=gl.getUniformLocation(prog,"u_c1"),uC2=gl.getUniformLocation(prog,"u_c2");
  const paint=()=>{const theme=document.documentElement.dataset.theme==="light"?THEMES.light:THEMES.dark;
   gl.uniform3fv(uBg,hex(theme.bg));gl.uniform3fv(uC1,hex(theme.c1));gl.uniform3fv(uC2,hex(theme.c2));};
  paint();
  const resize=()=>{const dpr=Math.min(window.devicePixelRatio||1,1.5);const r=canvas.getBoundingClientRect();
   canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));
   gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(uRes,canvas.width,canvas.height);};
  resize();
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf=0,visible=true,start=performance.now();
  const draw=(now:number)=>{gl.uniform1f(uTime,reduce?8:(now-start)/1000);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   if(!reduce&&visible)raf=requestAnimationFrame(draw);};
  raf=requestAnimationFrame(draw);
  const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;cancelAnimationFrame(raf);if(visible)raf=requestAnimationFrame(draw);});
  io.observe(canvas);
  const ro=new ResizeObserver(()=>{resize();if(reduce)raf=requestAnimationFrame(draw);});ro.observe(canvas);
  const mo=new MutationObserver(()=>{paint();if(reduce)raf=requestAnimationFrame(draw);});
  mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  return()=>{cancelAnimationFrame(raf);io.disconnect();ro.disconnect();mo.disconnect();};
 },[]);
 return <canvas ref={ref} className={"tt-wave "+className} aria-hidden="true"/>;
}
