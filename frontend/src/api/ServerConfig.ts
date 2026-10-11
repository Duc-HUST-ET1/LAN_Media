const key='lan-media.server-url';
export function configuredServerUrl():string{return localStorage.getItem(key)??'';}
export function apiUrl(path:string):string{return `${configuredServerUrl().replace(/\/$/,'')}${path}`;}
export function validateServerUrl(value:string):string{
  let url:URL;try{url=new URL(value.trim());}catch{throw new Error('Enter a complete server URL, such as http://192.168.1.20:3000.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Use an HTTP or HTTPS server origin without credentials or a path.');
  if(url.hostname==='0.0.0.0'||url.hostname==='::')throw new Error('Use the server LAN address or hostname, not its bind address.');
  return url.origin;
}
export async function testServerUrl(value:string):Promise<{url:string;health:unknown;elapsedMs:number}>{
  const url=validateServerUrl(value),start=performance.now();
  const response=await fetch(`${url}/api/health`,{signal:AbortSignal.timeout(5000)});
  if(!response.ok&&response.status!==503)throw new Error(`Server returned HTTP ${response.status}.`);
  const health=await response.json() as {service?:string};if(health.service!=='LAN-Media Backend')throw new Error('The address did not return a LAN-Media server.');
  return {url,health,elapsedMs:Math.round(performance.now()-start)};
}
export function saveServerUrl(url:string):void{if(url)localStorage.setItem(key,url);else localStorage.removeItem(key);}
