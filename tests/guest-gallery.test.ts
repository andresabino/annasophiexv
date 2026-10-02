import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guestGalleryCanUpload,guestGalleryCanView,MAX_GUEST_PHOTO_BYTES,MAX_GUEST_PHOTOS} from '../src/lib/guest-gallery';

test('guest gallery follows event phases and the administrative switch',()=>{
 assert.equal(guestGalleryCanUpload('INVITATION',true),false);
 assert.equal(guestGalleryCanUpload('EVENT_DAY',true),true);
 assert.equal(guestGalleryCanUpload('POST_EVENT',true),true);
 assert.equal(guestGalleryCanUpload('EVENT_DAY',false),false);
 assert.equal(guestGalleryCanView('EVENT_DAY'),false);
 assert.equal(guestGalleryCanView('POST_EVENT'),true);
});

test('guest upload limits match the public contract',()=>{
 assert.equal(MAX_GUEST_PHOTOS,10);
 assert.equal(MAX_GUEST_PHOTO_BYTES,10*1024*1024);
});
