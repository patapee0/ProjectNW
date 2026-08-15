/**
 * Media Service — 3-Second Short Video Clip Processing using FFmpeg
 * (คงเดิมจาก version เก่า)
 */
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

/**
 * ตัดวิดีโอให้เหลือ 3 วินาที, ปิดเสียง, สร้าง thumbnail
 */
async function process3SecVideoClip(inputFilePath, outputDir) {
  const filename = path.basename(inputFilePath, path.extname(inputFilePath));
  const outputVideoName = `${filename}_3s.mp4`;
  const outputThumbName = `${filename}_thumb.jpg`;

  const outputVideoPath = path.join(outputDir, outputVideoName);

  return new Promise((resolve, reject) => {
    ffmpeg(inputFilePath)
      .setStartTime('00:00:00')
      .setDuration(3.0)
      .withFps(30)
      .outputOptions(['-an', '-vf scale=720:-2'])
      .output(outputVideoPath)
      .on('end', () => {
        ffmpeg(outputVideoPath)
          .screenshots({
            timestamps: ['00:00:01'],
            filename: outputThumbName,
            folder: outputDir,
            size: '400x600'
          })
          .on('end', () => {
            resolve({
              videoUrl: `/uploads/${outputVideoName}`,
              thumbnailUrl: `/uploads/${outputThumbName}`,
              duration: 3.0
            });
          })
          .on('error', reject);
      })
      .on('error', reject)
      .run();
  });
}

module.exports = { process3SecVideoClip };
