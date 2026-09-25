// Rolling real frame intervals, not a guessed FPS or a CPU utilization percentage.
export function createFrameMeter(){
 const frames=[],stutters=[];let last=null;
 return {reset(){frames.length=0;stutters.length=0;last=null;},frame(now){if(last!==null){const ms=now-last;if(ms>0&&Number.isFinite(ms)){frames.push({at:now,ms});if(ms>50)stutters.push(now);}}last=now;while(stutters.length&&stutters[0]<now-10000)stutters.shift();while(frames.length>600||(frames.length&&frames[0].at<now-10000))frames.shift();},read(now){const recent=frames.filter(f=>f.at>now-2000);if(!recent.length)return null;const values=recent.map(f=>f.ms).sort((a,b)=>a-b),total=values.reduce((a,b)=>a+b,0);return {fps:1000*values.length/total,p95:values[Math.ceil(values.length*.95)-1],stutters:stutters.filter(t=>t>now-10000).length};}};
}
