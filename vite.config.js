import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

function serveIeltsMediaPlugin() {
  const mediaDir = '/Users/arunyagoojar/Downloads/IELTS Media';
  return {
    name: 'serve-ielts-media',
    configureServer(server) {
      server.middlewares.use('/videos', (req, res, next) => {
        const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
        const filePath = path.join(mediaDir, decodedUrl);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const stat = fs.statSync(filePath);
          const range = req.headers.range;
          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'video/mp4',
            });
            file.pipe(res);
            return;
          }
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes'
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serveIeltsMediaPlugin()],
  server: {
    fs: {
      allow: ['/Users/arunyagoojar/Documents/cognition', '/Users/arunyagoojar/Downloads/IELTS Media']
    }
  }
})
