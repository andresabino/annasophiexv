ALTER TABLE events ADD COLUMN IF NOT EXISTS guest_capacity integer NOT NULL DEFAULT 100 CHECK(guest_capacity > 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS staff_capacity integer NOT NULL DEFAULT 10 CHECK(staff_capacity >= 0);

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS expected_guests integer NOT NULL DEFAULT 1 CHECK(expected_guests BETWEEN 1 AND 100);
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS invitation_round integer NOT NULL DEFAULT 1 CHECK(invitation_round > 0);
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS rsvp_deadline timestamptz;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_ciphertext text;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS revoked_reason text;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS is_expected boolean NOT NULL DEFAULT true;
ALTER TABLE rsvp_participants ADD COLUMN IF NOT EXISTS guest_id bigint REFERENCES guests(id) ON DELETE SET NULL;
ALTER TABLE rsvps DROP CONSTRAINT IF EXISTS rsvps_status_check;
ALTER TABLE rsvps ADD CONSTRAINT rsvps_status_check CHECK(status IN ('confirmed','declined','cancelled'));
ALTER TABLE rsvps DROP CONSTRAINT IF EXISTS rsvps_check;
ALTER TABLE rsvps ADD CONSTRAINT rsvps_status_count_check CHECK((status IN ('declined','cancelled') AND confirmed_guests=0) OR (status='confirmed' AND confirmed_guests>0));

CREATE TABLE admin_users(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('ADMIN','EDITOR')),
 active boolean NOT NULL DEFAULT true,
 last_login_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_sessions(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 admin_user_id bigint NOT NULL REFERENCES admin_users ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK(length(token_hash)=64),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);

CREATE TABLE rsvp_history(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 rsvp_id bigint NOT NULL REFERENCES rsvps ON DELETE CASCADE,
 changed_by_type text NOT NULL CHECK(changed_by_type IN ('GUEST','ADMIN')),
 admin_user_id bigint REFERENCES admin_users,
 previous_status text,
 new_status text NOT NULL,
 previous_confirmed_guests integer,
 new_confirmed_guests integer NOT NULL,
 snapshot jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rsvp_history_rsvp ON rsvp_history(rsvp_id,created_at DESC);

CREATE TABLE audit_log(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 admin_user_id bigint REFERENCES admin_users,
 action text NOT NULL,
 entity_type text NOT NULL,
 entity_id bigint,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created ON audit_log(created_at DESC);
CREATE INDEX invitations_round ON invitations(event_id,invitation_round);
CREATE INDEX invitations_deadline ON invitations(event_id,rsvp_deadline) WHERE revoked_at IS NULL;

UPDATE events SET event_time='17:30',guest_capacity=100,staff_capacity=10 WHERE slug='anna-sophie-xv';

CREATE OR REPLACE FUNCTION enforce_event_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE planned integer; capacity integer; event_key bigint;
BEGIN
 event_key := COALESCE(NEW.event_id,OLD.event_id);
 SELECT guest_capacity INTO capacity FROM events WHERE id=event_key FOR UPDATE;
 SELECT COALESCE(sum(CASE WHEN r.status='confirmed' THEN r.confirmed_guests WHEN i.active AND i.revoked_at IS NULL THEN i.max_guests ELSE 0 END),0)
 INTO planned FROM invitations i LEFT JOIN rsvps r ON r.invitation_id=i.id
 WHERE i.event_id=event_key AND i.id<>COALESCE(NEW.id,-1);
 IF TG_OP<>'DELETE' AND NEW.active AND NEW.revoked_at IS NULL THEN
   planned := planned + COALESCE((SELECT confirmed_guests FROM rsvps WHERE invitation_id=NEW.id AND status='confirmed'),NEW.max_guests);
 END IF;
 IF planned > capacity THEN RAISE EXCEPTION 'Event guest capacity exceeded (%/%).',planned,capacity; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS invitation_event_capacity ON invitations;
CREATE CONSTRAINT TRIGGER invitation_event_capacity AFTER INSERT OR UPDATE OF max_guests,active,revoked_at ON invitations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_event_capacity();
