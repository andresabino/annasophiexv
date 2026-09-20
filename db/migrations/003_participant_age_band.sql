ALTER TABLE rsvp_participants
  ADD COLUMN IF NOT EXISTS age_band text;

ALTER TABLE rsvp_participants
  DROP CONSTRAINT IF EXISTS rsvp_participants_age_band_check;

ALTER TABLE rsvp_participants
  ADD CONSTRAINT rsvp_participants_age_band_check
  CHECK(age_band IS NULL OR age_band IN ('0_7','8_12'));

CREATE INDEX IF NOT EXISTS rsvp_participants_age_band
  ON rsvp_participants(age_band)
  WHERE age_band IS NOT NULL;
