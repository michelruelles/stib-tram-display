# STIB Tram Display

A simple, mobile-friendly webpage that displays real-time tram departure times for Brussels STIB/MIVB network. Perfect for mounting on an old Android phone by your front door!

## Features

- 🚊 Real-time departure times from STIB/MIVB open data API
- 📱 Fully responsive mobile design
- 🔄 Auto-refreshes every 30 seconds
- 📍 Currently configured for stop **6805F**
- 🎨 Large, easy-to-read format visible from a distance
- ⚡ No backend required - runs completely in the browser
- 🆓 Uses free public STIB/MIVB API (no authentication needed)

## Quick Start

### Online (Recommended)
Simply visit: **https://michelruelles.github.io/stib-tram-display/**

The page will automatically load and display current tram departure times.

### On Your Android Phone

1. Open the link above in your phone's browser (Chrome, Firefox, etc.)
2. Bookmark the page for quick access
3. For a home screen shortcut:
   - In Chrome: Tap menu (⋮) → "Add to Home screen"
   - The app will appear on your home screen like a native app

### Local Deployment (Alternative)
If you want to run it locally on your network:

```bash
# Python 3
python3 -m http.server 8000

# Then access: http://your-computer-ip:8000/index.html
