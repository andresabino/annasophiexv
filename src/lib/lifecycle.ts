export type Phase = 'SAVE_THE_DATE' | 'INVITATION' | 'EVENT_DAY' | 'POST_EVENT';
export type Window = { startsAt: string | null; endsAt: string | null };
export type Lifecycle = { saveTheDate: Window; invitation: Window; rsvp: Window; gifts: Window; pix: Window & {enabled:boolean}; postEvent: {startsAt:string|null} };
export const EVENT_START = '2026-12-06T18:15:00-03:00';
const empty = (): Window => ({ startsAt: null, endsAt: null });
export const defaultLifecycle = (): Lifecycle => ({saveTheDate:empty(), invitation:empty(), rsvp:empty(), gifts:empty(), pix:{...empty(),enabled:false},postEvent:{startsAt:null}});
export function parseDate(value: unknown): string | null {
  if(value === null || value === undefined || value === '') return null;
  if(typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('A data deve ser ISO com fuso horário explícito.');
  return value;
}
export function validateLifecycle(input: unknown): Lifecycle {
  const value = input as Lifecycle;
  const result = defaultLifecycle();
  for(const key of ['saveTheDate','invitation','rsvp','gifts','pix'] as const){
    result[key].startsAt = parseDate(value?.[key]?.startsAt);
    result[key].endsAt = parseDate(value?.[key]?.endsAt);
    const {startsAt,endsAt} = result[key];
    if(startsAt && endsAt && Date.parse(endsAt)<=Date.parse(startsAt)) throw new Error('O encerramento deve ser posterior à abertura.');
  }
  result.pix.enabled = value?.pix?.enabled === true;
  result.postEvent.startsAt = parseDate(value?.postEvent?.startsAt);
  if(result.postEvent.startsAt && Date.parse(result.postEvent.startsAt)<Date.parse(EVENT_START)) throw new Error('Pós-evento anterior ao baile.');
  return result;
}
export function inWindow(window:Window, now:Date){return !!window.startsAt && now.getTime()>=Date.parse(window.startsAt) && (!window.endsAt || now.getTime()<Date.parse(window.endsAt));}
export function getCurrentSitePhase(config:Lifecycle, now=new Date()):Phase {
  if(config.postEvent.startsAt && now.getTime()>=Date.parse(config.postEvent.startsAt)) return 'POST_EVENT';
  if(now.getTime()>=Date.parse(EVENT_START)) return 'EVENT_DAY';
  if(inWindow(config.invitation,now)) return 'INVITATION';
  return 'SAVE_THE_DATE';
}
export function resolvePreview(actual:Phase, preview:string|null, development:boolean):Phase {
  const map:Record<string,Phase>={'save-the-date':'SAVE_THE_DATE',invitation:'INVITATION','event-day':'EVENT_DAY','post-event':'POST_EVENT'};
  return development && preview && map[preview] ? map[preview] : actual;
}
export const isPostEvent=(c:Lifecycle,n=new Date())=>getCurrentSitePhase(c,n)==='POST_EVENT';
export const isEventLive=(c:Lifecycle,n=new Date())=>getCurrentSitePhase(c,n)==='EVENT_DAY';
export const isInvitationActive=(c:Lifecycle,n=new Date())=>getCurrentSitePhase(c,n)==='INVITATION';
export const isSaveTheDateActive=(c:Lifecycle,n=new Date())=>getCurrentSitePhase(c,n)==='SAVE_THE_DATE';
export const isRsvpOpen=(c:Lifecycle,n=new Date())=>!isPostEvent(c,n)&&inWindow(c.rsvp,n);
export const isGiftListActive=(c:Lifecycle,n=new Date())=>!isPostEvent(c,n)&&inWindow(c.gifts,n);
export const isPixActive=(c:Lifecycle,n=new Date())=>c.pix.enabled&&isGiftListActive(c,n)&&inWindow(c.pix,n);

export const rsvpNotYetOpen=(c:Lifecycle,n=new Date())=>!c.rsvp.startsAt||Date.parse(c.rsvp.startsAt)>n.getTime();
