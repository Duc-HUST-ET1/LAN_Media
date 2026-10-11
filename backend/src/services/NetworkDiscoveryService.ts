import { createSocket, type Socket } from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { appConfig } from '../core/config/AppConfig.js';

export function isDiscoveryRequest(packet:Buffer):boolean{
  if(packet.length>256)return false;
  try{const request=JSON.parse(packet.toString()) as {service?:unknown;version?:unknown;type?:unknown};return request.service==='lan-media'&&request.version===1&&request.type==='discover';}
  catch{return false;}
}

export class NetworkDiscoveryService {
  private socket:Socket|null=null;
  start():void {
    if(!appConfig.discoveryEnabled)return;
    if(!Number.isInteger(appConfig.discoveryPort)||appConfig.discoveryPort<1||appConfig.discoveryPort>65535){console.warn('[discovery] invalid UDP port; discovery disabled');return;}
    const socket=createSocket({type:'udp4',reuseAddr:true}); let recent=new Map<string,number>();
    socket.on('message',(packet,remote)=>{
      try {
        if(!isDiscoveryRequest(packet))return;
        const now=Date.now(),last=recent.get(remote.address)??0;if(now-last<1500)return;recent.set(remote.address,now);
        if(recent.size>512)recent=new Map([...recent].filter(([,time])=>now-time<60000));
        const local=Object.values(networkInterfaces()).flatMap(list=>(list??[]).filter(i=>i.family==='IPv4'&&!i.internal).map(i=>i.address));
        const response=Buffer.from(JSON.stringify({service:'LAN-Media',version:1,available:true,httpPort:appConfig.port,websocketPath:'/ws',addresses:local.slice(0,8)}));
        socket.send(response,remote.port,remote.address);
      }catch{/* Ignore malformed discovery packets. */}
    });
    socket.on('error',error=>{console.warn('[discovery] UDP listener unavailable:',error.message);try{socket.close();}catch{/* A bind failure may already have closed the socket. */}if(this.socket===socket)this.socket=null;});
    socket.bind(appConfig.discoveryPort,appConfig.host,()=>{this.socket=socket;console.log(`[discovery] UDP listening on ${appConfig.discoveryPort}`);});
  }
  close():void{this.socket?.close();this.socket=null;}
}
