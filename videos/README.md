# Videos Directory

This directory stores generated Wordle progress videos.

## Generating Videos

1. Login to admin console (http://localhost:3000/admin)
2. Find "Generate Video" section
3. Choose video type (2D or 3D)
4. Click "Generate Video"
5. Wait a few minutes
6. Video appears in public view

## Video Types

- **2D Animation** - Sliding window view, recommended for web
- **3D Animation** - Same as 2D (future: rotating 3D visualization)

## Video Specifications

- Format: MP4 (H.264)
- Resolution: 1920x1080
- Frame Rate: 3 FPS (configurable)
- Compatible with all modern browsers and devices

## Storage

Videos can be large (5-50MB depending on data).

To save space, delete old videos:
```bash
rm videos/wordle_old_*.mp4
```

The most recent video is automatically used in the public view.

## Requirements

Video generation requires:
- ffmpeg installed on system
- Sufficient disk space

**Note**: Videos are generated entirely in Node.js using Canvas and ffmpeg. No Python required!


