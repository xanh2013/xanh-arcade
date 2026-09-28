import {runResourceTask,createDutyCycleScheduler,createResourceCache,resourceCacheBytes} from './resource-sharing.js';
const scheduler=createDutyCycleScheduler(),cache=createResourceCache();
self.onmessage=({data})=>scheduler.enqueue(()=>{const start=performance.now();const result=runResourceTask(data.task,{cache});return {result,cpuMs:performance.now()-start,ramBytes:resourceCacheBytes(cache)};}).then(value=>self.postMessage({id:data.id,...value})).catch(error=>self.postMessage({id:data.id,error:String(error.message||error)}));
