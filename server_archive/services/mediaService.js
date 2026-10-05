/**
 * Media Service - 3-Second Short Video Clip Processing using FFmpeg
 */
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * Clips an uploaded video file to exactly 3.0 seconds max, mutes audio for ambient loop,
 * and extracts a JPEG thumbnail frame.
 * 
 * @param {string} inputFilePath - Path to uploaded source video
 * @param {string} outputDir - Path to output storage directory
 * @returns {Promise<{ videoUrl: string, thumbnailUrl: string, duration: number }>}
 */
async function process3SecVideoClip(inputFilePath, outputDir) {
  const filename = path.basename(inputFilePath, path.extname(inputFilePath));
  const outputVideoName = `${filename}_3s.mp4`;
  const outputThumbName = `${filename}_thumb.jpg`;

  const outputVideoPath = path.join(outputDir, outputVideoName);
  const outputThumbPath = path.join(outputDir, outputThumbName);

  return new Promise((resolve, reject) => {
    // 1. Process Video Clip to 3 Seconds
    ffmpeg(inputFilePath)
      .setStartTime('00:00:00')
      .setDuration(3.0) // Clip max 3 seconds
      .withFps(30)
      .outputOptions(['-an', '-vf scale=720:-2']) // Mute sound, scale to 720p width
      .output(outputVideoPath)
      .on('end', () => {
        // 2. Generate Thumbnail Image from 1st second
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

module.exports = {
  process3SecVideoClip
};
