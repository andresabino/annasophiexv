import {createHash,randomBytes} from 'node:crypto';
export const generateToken=()=>randomBytes(32).toString('base64url');
export const validToken=(token:string)=>/^[A-Za-z0-9_-]{43}$/.test(token);
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
