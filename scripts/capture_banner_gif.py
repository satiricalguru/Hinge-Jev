import os
import shutil
import subprocess
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "scripts" / "banner.html"
FRAMES_DIR = ROOT / "scripts" / "frames"
OUTPUT_GIF = ROOT / "docs" / "banner.gif"

if FRAMES_DIR.exists():
    shutil.rmtree(FRAMES_DIR)
FRAMES_DIR.mkdir(parents=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="chrome")
    page = browser.new_page(
        viewport={"width": 1200, "height": 400},
        device_scale_factor=1,
    )
    page.goto(f"file://{HTML_PATH}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    # Capture 70 frames at ~20fps (3.5s loop)
    fps = 20
    total_frames = 70
    interval = 1.0 / fps

    print(f"Capturing {total_frames} frames...")
    for i in range(total_frames):
        frame_path = FRAMES_DIR / f"frame_{i:04d}.png"
        page.screenshot(path=str(frame_path))
        time.sleep(interval)

    browser.close()

print("Compiling GIF with ffmpeg...")
# Generate optimal palette and GIF
palette_path = FRAMES_DIR / "palette.png"
subprocess.run(
    [
        "ffmpeg",
        "-y",
        "-framerate",
        str(fps),
        "-i",
        str(FRAMES_DIR / "frame_%04d.png"),
        "-vf",
        "fps=20,scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff",
        str(palette_path),
    ],
    check=True,
)

subprocess.run(
    [
        "ffmpeg",
        "-y",
        "-framerate",
        str(fps),
        "-i",
        str(FRAMES_DIR / "frame_%04d.png"),
        "-i",
        str(palette_path),
        "-lavfi",
        "fps=20,scale=1200:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3",
        str(OUTPUT_GIF),
    ],
    check=True,
)

# Cleanup frames
shutil.rmtree(FRAMES_DIR)
print(f"Generated {OUTPUT_GIF} ({OUTPUT_GIF.stat().st_size / 1024:.1f} KB)")
