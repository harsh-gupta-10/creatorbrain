// An original 120 BPM instrumental with FM keys, bass, soft percussion and interface cues.
const fs = require('node:fs');
const rate=44100, duration=55, count=rate*duration, left=new Float32Array(count), right=new Float32Array(count);
let seed=39;
function noise(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1}
function sound(at,len,gain,pan,fn){
  let start=Math.round(at*rate), stop=Math.min(Math.round(len*rate),count-start);
  const l=gain*Math.sqrt((1-pan)*.5),r=gain*Math.sqrt((1+pan)*.5);
  for(let i=0;i<stop;i++){const t=i/rate,v=fn(t)*Math.min(1,i/60,(stop-i)/340);left[start+i]+=v*l;right[start+i]+=v*r}
}
const tau=Math.PI*2, hz=k=>440*2**((k-69)/12);
function key(at,n,len,gain,pan=0){let f=hz(n);sound(at,len,gain,pan,t=>Math.min(1,t/.008)*Math.exp(-3.2*t/len)*(Math.sin(tau*f*t+.85*Math.exp(-12*t)*Math.sin(tau*f*2*t))+.15*Math.sin(tau*f*2.003*t)))}
const chords=[[50,57,61,64,66],[47,54,57,61,64],[43,50,54,57,61],[45,52,55,59,62]];
for(let bar=0;bar<26;bar++){
  const start=bar*2, chord=chords[Math.floor(bar/2)%4], last=bar===25;
  chord.slice(1).forEach((n,j)=>key(start+j*.022,n,1.97,.064,j*.39-.58));
  for(let b=0;b<4;b++){
    let at=start+b*.5;
    if(bar>1 && !last && (b===0||b===2))sound(at,.26,.4,0,t=>Math.sin(tau*(47*t+1.85*(1-Math.exp(-34*t))))*Math.exp(-17*t));
    if(bar>3&&!last&&b%2===1)sound(at,.13,.135,.13,t=>(noise()*.77+.23*Math.sin(190*tau*t))*Math.exp(-37*t));
    if(bar>2 && !last)for(let h=0;h<2;h++)sound(at+h*.25+.008,.07,.042,h?.52:-.38,t=>noise()*Math.exp(-60*t));
    if(b%2===0)key(at+.012,chord[0]-12,b===0?.71:.39,.24);
  }
  if(!last)[[.25,2],[.75,3],[1.375,1],[1.75,4]].forEach(([beat,j],i)=>{
    if(bar%4===3 && i===2)return; const n=chord[j]+12;key(start+beat,n,.52,.108,i%2?.42:-.43);key(start+beat+.1875,n,.32,.024,i%2?-.42:.43);
  });
}
[5.5,13,21,30,38,45.5,50.5].forEach((cut,i)=>{
  sound(cut-.24,.24,.049,-.18,t=>noise()*Math.pow(t/.24,2));
  key(cut+.035,[78,81,76,78,81,76,81][i],.34,.105,.28);
});
[25.67,33.12,42.15,47.55].forEach(at=>key(at,90,.085,.065,.24));
[50,57,61,64,66,73].forEach((n,j)=>key(52+j*.068,n,2.85-j*.068,.14-j*.012,j*.19-.48));
const wav=Buffer.alloc(44+count*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(count*4,40);
for(let i=0;i<count;i++){let gain=Math.min(1,i/(rate*.2),(count-i)/(rate*.75));wav.writeInt16LE(Math.round(30000*gain*Math.tanh(left[i]*2)),44+i*4);wav.writeInt16LE(Math.round(30000*gain*Math.tanh(right[i]*2)),46+i*4)}
fs.writeFileSync(process.argv[2],wav);
