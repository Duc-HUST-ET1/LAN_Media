import type { Request,Response } from 'express';
import { NetworkStatusService } from '../services/NetworkStatusService.js';
const service=new NetworkStatusService();
export async function networkStatus(_request:Request,response:Response):Promise<void>{response.setHeader('Cache-Control','no-store');response.json(await service.getStatus());}
