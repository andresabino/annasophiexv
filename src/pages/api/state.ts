import type {APIRoute} from 'astro';
import {siteState} from '../../lib/config';
export const GET:APIRoute=async({url})=>{const {phase,gifts,rsvp,pix}=await siteState(url);return Response.json({phase,gifts,rsvp,pix})};