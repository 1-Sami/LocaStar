-- Spelling/grammar fixes for categories added in 0028 (slugs are left
-- untouched — they're internal identifiers, not shown to users).
update categories set name = 'American Football' where slug = 'amerikan-fotball';
update categories set name = 'Picnic parks' where slug = 'picknick-parks';
update categories set name = 'Outdoor recreation area (Friluftsplats)' where slug = 'outdoor';
update categories set name = 'Track & Field Stadium' where slug = 'track-and-field-stadium';
