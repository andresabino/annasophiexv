import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guestGalleryCanUpload,guestGalleryCanView,MAX_GUEST_PHOTO_BYTES,MAX_GUEST_PHOTOS} from '../src/lib/guest-gallery';

test('guest gallery follows event phases and the administrative switch',()=>{
 const defaultWindow={startsAt:null,endsAt:null};
 assert.equal(guestGalleryCanUpload('INVITATION',true,new Date(),defaultWindow),false);
 assert.equal(guestGalleryCanUpload('EVENT_DAY',true,new Date(),defaultWindow),true);
 assert.equal(guestGalleryCanUpload('POST_EVENT',true,new Date(),defaultWindow),true);
 assert.equal(guestGalleryCanUpload('EVENT_DAY',false,new Date(),defaultWindow),false);
 assert.equal(guestGalleryCanView('EVENT_DAY'),false);
 assert.equal(guestGalleryCanView('POST_EVENT'),true);
});

test('an explicit environment window can open uploads before the event',()=>{
 const window={startsAt:'2026-10-02T00:00:00-03:00',endsAt:'2026-12-31T23:59:59-03:00'};
 assert.equal(guestGalleryCanUpload('INVITATION',true,new Date('2026-10-02T12:00:00-03:00'),window),true);
 assert.equal(guestGalleryCanUpload('INVITATION',true,new Date('2026-10-01T23:59:59-03:00'),window),false);
 assert.equal(guestGalleryCanUpload('POST_EVENT',true,new Date('2026-12-31T23:59:59-03:00'),window),false);
 assert.equal(guestGalleryCanUpload('INVITATION',false,new Date('2026-10-02T12:00:00-03:00'),window),false);
});

test('guest upload limits match the public contract',()=>{
 assert.equal(MAX_GUEST_PHOTOS,10);
 assert.equal(MAX_GUEST_PHOTO_BYTES,10*1024*1024);
});
