import {database,EVENT_SLUG} from '../db';

export function billingSummary(adults:number,halfPriceChildren:number,freeChildren:number,contractedMinimum=100){
 const billableEquivalent=adults+halfPriceChildren/2;
 return{
  adults,
  halfPriceChildren,
  freeChildren,
  billableEquivalent,
  contractedMinimum,
  remainingToMinimum:Math.max(0,contractedMinimum-billableEquivalent),
  excessEquivalent:Math.max(0,billableEquivalent-contractedMinimum)
 };
}

export async function capacitySummary(){
 const {rows}=await database().query(`SELECT e.guest_capacity capacity,
  COALESCE(sum(CASE WHEN r.status='confirmed' THEN r.confirmed_guests ELSE 0 END),0)::int confirmed,
  COALESCE(sum(CASE WHEN r.id IS NULL AND i.active AND i.revoked_at IS NULL THEN i.max_guests ELSE 0 END),0)::int committed,
  COALESCE(sum(CASE WHEN i.revoked_at IS NOT NULL OR r.status IN ('declined','cancelled') THEN i.max_guests ELSE 0 END),0)::int released,
  COALESCE((SELECT count(*) FROM rsvp_participants p JOIN rsvps rx ON rx.id=p.rsvp_id WHERE rx.event_id=e.id AND rx.status='confirmed' AND p.age_band='0_7'),0)::int age_0_7,
  COALESCE((SELECT count(*) FROM rsvp_participants p JOIN rsvps rx ON rx.id=p.rsvp_id WHERE rx.event_id=e.id AND rx.status='confirmed' AND p.age_band='8_12'),0)::int age_8_12
  FROM events e LEFT JOIN invitations i ON i.event_id=e.id LEFT JOIN rsvps r ON r.invitation_id=i.id
  WHERE e.slug=$1 GROUP BY e.id`,[EVENT_SLUG]);
 const value=rows[0]||{capacity:100,confirmed:0,committed:0,released:0,age_0_7:0,age_8_12:0};
 const adults=Math.max(0,value.confirmed-value.age_0_7-value.age_8_12);
 return{...value,...billingSummary(adults,value.age_8_12,value.age_0_7,value.capacity),planned:value.confirmed+value.committed};
}
