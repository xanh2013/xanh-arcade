let deferredInstall=null;
function installButton(){return document.getElementById('install-app');}
function syncInstallButton(){const b=installButton();if(b)b.hidden=!deferredInstall;}
if('serviceWorker'in navigator){
 addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}),{once:true});
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.documentElement.dataset.installable='1';syncInstallButton();});
addEventListener('appinstalled',()=>{deferredInstall=null;delete document.documentElement.dataset.installable;syncInstallButton();});
export async function installXanhArcade(){if(!deferredInstall)return false;const prompt=deferredInstall;deferredInstall=null;syncInstallButton();prompt.prompt();const result=await prompt.userChoice;return result.outcome==='accepted';}
addEventListener('DOMContentLoaded',()=>{syncInstallButton();const b=installButton();if(b)b.onclick=()=>installXanhArcade();},{once:true});
