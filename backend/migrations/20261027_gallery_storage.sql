-- Gallery sorting, cover selection and external object storage (additive).
ALTER TABLE demo_event_gallery_images ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE demo_event_gallery_images ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE demo_event_gallery_images ADD COLUMN IF NOT EXISTS object_key VARCHAR(255);
ALTER TABLE demo_event_gallery_images ALTER COLUMN image_bytes DROP NOT NULL;
CREATE INDEX IF NOT EXISTS ix_demo_event_gallery_sort
 ON demo_event_gallery_images(event_id,position,id);
