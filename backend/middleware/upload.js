const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

function ensureDir(subfolder) {
  const dir = path.join(__dirname, '..', 'uploads', subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeStorage(subfolder) {
  const dir = ensureDir(subfolder);
  return multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${uuid()}${ext}`);
    }
  });
}

// Original image-only uploader (avatars, covers, stories, story-style single images).
function makeUploader(subfolder) {
  return multer({
    storage: makeStorage(subfolder),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (/^image\//.test(file.mimetype)) cb(null, true);
      else cb(new Error('Chỉ chấp nhận file ảnh.'));
    }
  });
}

// Video-only uploader (Reels, video posts). Larger size limit than images.
function makeVideoUploader(subfolder, maxSizeMB = 100) {
  return multer({
    storage: makeStorage(subfolder),
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (/^video\//.test(file.mimetype)) cb(null, true);
      else cb(new Error('Chỉ chấp nhận file video.'));
    }
  });
}

// Mixed uploader for the post composer: up to 10 images OR 1 video (Facebook-style — a
// post carries either a photo set or a single video, never both at once).
function makePostMediaUploader(subfolder, maxVideoMB = 100) {
  return multer({
    storage: makeStorage(subfolder),
    limits: { fileSize: maxVideoMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.fieldname === 'video') {
        if (/^video\//.test(file.mimetype)) return cb(null, true);
        return cb(new Error('Trường video chỉ chấp nhận file video.'));
      }
      if (file.fieldname === 'images') {
        if (/^image\//.test(file.mimetype)) return cb(null, true);
        return cb(new Error('Trường ảnh chỉ chấp nhận file ảnh.'));
      }
      cb(new Error('Trường tệp không hợp lệ.'));
    }
  }).fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]);
}

module.exports = { makeUploader, makeVideoUploader, makePostMediaUploader };
