import {runResourceTask,createDutyCycleScheduler} from './resource-sharing.js';
const scheduler=createDutyCycleScheduler();
self.onmessage=({data})=>scheduler.enqueue(()=>{const start=performance.now();const result=runResourceTask(data.task);return {result,cpuMs:performance.now()-start};}).then(value=>self.postMessage({id:data.id,...value})).catch(error=>self.postMessage({id:data.id,error:String(error.message||error)}));
