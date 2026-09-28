-- Consolida na V3 as capacidades administrativas por evento e a gestão de staff.
CREATE TABLE IF NOT EXISTS admin_user_events(
 admin_user_id bigint NOT NULL REFERENCES admin_users ON DELETE CASCADE,
 event_id bigint NOT NULL REFERENCES events ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(admin_user_id,event_id)
);

INSERT INTO admin_user_events(admin_user_id,event_id)
SELECT u.id,e.id FROM admin_users u CROSS JOIN events e WHERE e.slug='anna-sophie-xv'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS event_staff(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id bigint NOT NULL REFERENCES events ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
 role_description text,
 phone text,
 notes text,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,event_id)
);

CREATE OR REPLACE FUNCTION enforce_event_staff_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE capacity integer; occupied integer;
BEGIN
 SELECT staff_capacity INTO capacity FROM events WHERE id=NEW.event_id FOR UPDATE;
 SELECT count(*)::integer INTO occupied FROM event_staff
 WHERE event_id=NEW.event_id AND active AND id<>COALESCE(NEW.id,-1);
 IF NEW.active THEN occupied:=occupied+1; END IF;
 IF occupied>capacity THEN RAISE EXCEPTION 'Staff capacity exceeded'; END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS staff_event_capacity ON event_staff;
CREATE TRIGGER staff_event_capacity BEFORE INSERT OR UPDATE OF active,event_id ON event_staff
FOR EACH ROW EXECUTE FUNCTION enforce_event_staff_capacity();
