/**
 * Run once to generate extension icons:
 *   node generate-icons.js
 * Requires: npm install canvas (in extension/ dir)
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 24; // scale factor (design is 24x24)

  // Background circle
  ctx.fillStyle = '#0a0a14';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(s, s);

  // Shield
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(3, 7);
  ctx.lineTo(3, 13);
  ctx.bezierCurveTo(3, 18.55, 6.84, 23.74, 12, 25);
  ctx.bezierCurveTo(17.16, 23.74, 21, 18.55, 21, 13);
  ctx.lineTo(21, 7);
  ctx.closePath();
  ctx.stroke();

  // Checkmark
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(9, 12);
  ctx.lineTo(11, 14);
  ctx.lineTo(15, 10);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

for (const size of [16, 48, 128]) {
  const buf = drawIcon(size);
  const outPath = path.join(__dirname, 'icons', `${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ icons/${size}.png`);
}
