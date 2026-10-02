ALTER TABLE events
  ADD COLUMN IF NOT EXISTS guest_gallery_uploads_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE guest_photos(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id bigint NOT NULL REFERENCES events ON DELETE CASCADE,
 uploader_name text CHECK(uploader_name IS NULL OR length(uploader_name) BETWEEN 1 AND 80),
 object_key text NOT NULL UNIQUE,
 thumbnail_object_key text NOT NULL UNIQUE,
 image_url text NOT NULL,
 thumbnail_url text NOT NULL,
 media_type text NOT NULL CHECK(media_type='image/webp'),
 byte_size integer NOT NULL CHECK(byte_size>0),
 width integer NOT NULL CHECK(width>0),
 height integer NOT NULL CHECK(height>0),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 featured boolean NOT NULL DEFAULT false,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 moderated_at timestamptz,
 moderated_by bigint REFERENCES admin_users ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_photos_public
  ON guest_photos(event_id,featured DESC,submitted_at DESC)
  WHERE status='APPROVED';
CREATE INDEX guest_photos_moderation
  ON guest_photos(event_id,status,submitted_at DESC);
