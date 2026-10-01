#!/usr/bin/env python3
"""
Brionicle Documentary Generator v2
TV-quality documentary from map locations.
Attenborough-style English narration, cinematic visuals, crossfade transitions.
"""

import json
import os
import sys
import subprocess
import urllib.request
import urllib.parse
import shutil
import argparse
import time
import hashlib
import glob as globmod
from pathlib import Path

HOME = Path.home()
OUTPUT_DIR = HOME / "Brionicle" / "output"
CACHE_DIR = HOME / "Brionicle" / ".cache"
VOICE_DIR = HOME / ".local" / "share" / "piper-voices"
MUSIC_DIR = HOME / "Brionicle" / "tools" / "music"

VOICE_EN = VOICE_DIR / "en_GB-alan-medium.onnx"
VOICE_NL = VOICE_DIR / "nl_NL-mls-medium.onnx"

COLORS = {
    "bg": "0x0f0a04",
    "bg_hex": "#0f0a04",
    "text": "#c5a55a",
    "subtext": "#a08b6c",
    "dark": "0x0a0602",
}

FPS = 25
RES = "1920x1080"


def log(msg, indent=0):
    prefix = "  " * indent
    print(f"{prefix}>> {msg}")


def ensure_dirs():
    for d in [OUTPUT_DIR, CACHE_DIR, CACHE_DIR / "images",
              CACHE_DIR / "audio", CACHE_DIR / "clips", MUSIC_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def cache_path(subdir, key, ext):
    safe = hashlib.md5(key.encode()).hexdigest()[:12]
    return CACHE_DIR / subdir / f"{safe}.{ext}"


def run_ff(cmd, desc="ffmpeg"):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log(f"{desc} fout: {result.stderr[:200]}", 2)
        raise subprocess.CalledProcessError(result.returncode, cmd)
    return result


# --- Wikipedia & Images ---

def fetch_wiki(page_name):
    for lang in ["en", "nl"]:
        url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(page_name)}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Brionicle-DocuGen/2.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return json.loads(resp.read())
        except Exception:
            continue
    return None


def fetch_commons_images(search_term, limit=6):
    url = (
        "https://commons.wikimedia.org/w/api.php?"
        f"action=query&generator=search&gsrnamespace=6&gsrsearch={urllib.parse.quote(search_term)}"
        f"&gsrlimit={limit}&prop=imageinfo&iiprop=url|size&iiurlwidth=1920&format=json"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Brionicle-DocuGen/2.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            pages = data.get("query", {}).get("pages", {})
            images = []
            for p in pages.values():
                info = p.get("imageinfo", [{}])[0]
                thumb = info.get("thumburl") or info.get("url")
                if thumb and info.get("width", 0) > 400:
                    images.append(thumb)
            return images
    except Exception:
        return []


def download_image(url, filepath):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Brionicle-DocuGen/2.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            with open(filepath, "wb") as f:
                f.write(resp.read())
        return os.path.getsize(filepath) > 1000
    except Exception:
        return False


def get_location_images(loc, wiki_data, max_images=5):
    imgs = []
    img_dir = CACHE_DIR / "images" / hashlib.md5(loc["name"].encode()).hexdigest()[:10]
    img_dir.mkdir(parents=True, exist_ok=True)

    existing = sorted(globmod.glob(str(img_dir / "*.jpg")))
    if len(existing) >= 2:
        return existing[:max_images]

    if wiki_data and wiki_data.get("thumbnail"):
        img_url = wiki_data["thumbnail"]["source"]
        img_url = img_url.replace("/220px-", "/1920px-").replace("/320px-", "/1920px-")
        path = str(img_dir / "00_wiki.jpg")
        if download_image(img_url, path):
            imgs.append(path)

    if wiki_data and wiki_data.get("originalimage"):
        path = str(img_dir / "01_original.jpg")
        if download_image(wiki_data["originalimage"]["source"], path):
            imgs.append(path)

    commons = fetch_commons_images(loc["name"], limit=6)
    for i, url in enumerate(commons):
        if len(imgs) >= max_images:
            break
        path = str(img_dir / f"{i+2:02d}_commons.jpg")
        if download_image(url, path):
            imgs.append(path)

    if not imgs:
        path = str(img_dir / "fallback.png")
        create_colored_card(path)
        imgs.append(path)

    return imgs


# --- Ollama (Llama 3.1) ---

def generate_narration_ollama(loc, wiki_extract="", style="attenborough"):
    prompt = f"""You are narrating a cinematic documentary in the style of David Attenborough.
Write a short, evocative narration in English for the following historical location.
5-7 sentences maximum. Use a tone of quiet wonder and revelation.
Speak as if unveiling a secret that has waited centuries to be told.
No bullet points, no lists — flowing, cinematic prose only.

Location: {loc['name']}
Type: {loc.get('type', 'unknown')}
Period: {loc.get('period', 'unknown')}
Description: {loc.get('description', '')}
Wikipedia: {wiki_extract[:800] if wiki_extract else 'not available'}

Narration:"""

    try:
        result = subprocess.run(
            ["ollama", "run", "llama3.1:8b"],
            input=prompt, capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0 and result.stdout.strip():
            text = result.stdout.strip()
            text = text.replace('"', '').replace("'", "'")
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            text = ' '.join(lines)
            if len(text) > 80:
                return text
    except Exception as e:
        log(f"Ollama error: {e}", 2)

    return f"{loc['name']}. {loc.get('description', 'A place steeped in hidden history.')}"


# --- TTS ---

def generate_speech(text, output_path, lang="en"):
    model = VOICE_EN if lang == "en" else VOICE_NL

    if model.exists():
        try:
            proc = subprocess.run(
                ["piper", "--model", str(model), "--output_file", str(output_path),
                 "--sentence_silence", "0.5", "--length_scale", "1.1"],
                input=text, capture_output=True, text=True, timeout=60
            )
            if proc.returncode == 0 and os.path.getsize(output_path) > 100:
                return True
        except Exception as e:
            log(f"Piper error: {e}, falling back to espeak", 2)

    voice = "en-gb" if lang == "en" else "mb-nl2"
    subprocess.run(
        ["espeak-ng", "-v", voice, "-s", "130", "-p", "30", "--stdout", text],
        stdout=open(output_path, "wb"), stderr=subprocess.DEVNULL
    )
    return True


def get_audio_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 5.0


# --- FFmpeg Video Components ---

def create_colored_card(output_path, color=None):
    c = color or COLORS["dark"]
    run_ff([
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={c}:s={RES}:d=1",
        "-frames:v", "1", str(output_path)
    ], "colored card")


def create_title_sequence(title, subtitle, output_path, audio_path=None, duration=7):
    safe_title = title.replace("'", "").replace(":", "").replace('"', '')
    safe_sub = subtitle.replace("'", "").replace(":", "").replace('"', '')

    vf = (
        f"color=c={COLORS['bg']}:s={RES}:d={duration}[bg];"
        f"[bg]drawtext=text='{safe_title}':"
        f"fontsize=80:fontcolor={COLORS['text']}:font=DejaVu Sans:"
        f"x=(w-tw)/2:y=(h-th)/2-50:"
        f"shadowcolor=black:shadowx=3:shadowy=3:"
        f"alpha='if(lt(t,1.5),t/1.5,if(gt(t,{duration-1.5}),({duration}-t)/1.5,1))',"
        f"drawtext=text='{safe_sub}':"
        f"fontsize=34:fontcolor={COLORS['subtext']}:font=DejaVu Sans:"
        f"x=(w-tw)/2:y=(h-th)/2+50:"
        f"alpha='if(lt(t,2),t/2,if(gt(t,{duration-1.5}),({duration}-t)/1.5,1))'"
    )

    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c={COLORS['bg']}:s={RES}:d={duration}",
    ]

    if audio_path and os.path.exists(str(audio_path)):
        cmd += ["-i", str(audio_path)]
        cmd += [
            "-filter_complex", vf.replace(f"color=c={COLORS['bg']}:s={RES}:d={duration}[bg];[bg]", ""),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
            "-shortest", "-r", str(FPS), str(output_path)
        ]
    else:
        cmd += [
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-vf", vf.replace(f"color=c={COLORS['bg']}:s={RES}:d={duration}[bg];[bg]", ""),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-t", str(duration), "-r", str(FPS), str(output_path)
        ]

    run_ff(cmd, "title sequence")


def create_location_intro(name, period, loc_type, output_path, duration=3):
    safe_name = name.replace("'", "").replace(":", "").replace('"', '')
    safe_period = str(period).replace("'", "") if period else ""
    type_label = {
        "loge": "Freemason Lodge", "tempel": "Knights Templar",
        "kerk": "Church", "spook": "Haunted", "kasteel": "Castle"
    }.get(loc_type, "Historical Site")

    vf = (
        f"drawtext=text='{safe_name}':"
        f"fontsize=64:fontcolor={COLORS['text']}:font=DejaVu Sans:"
        f"x=(w-tw)/2:y=(h-th)/2-40:"
        f"shadowcolor=black:shadowx=3:shadowy=3:"
        f"alpha='if(lt(t,0.8),t/0.8,if(gt(t,{duration-0.5}),({duration}-t)/0.5,1))',"
        f"drawtext=text='{type_label}  ·  {safe_period}':"
        f"fontsize=28:fontcolor={COLORS['subtext']}:font=DejaVu Sans:"
        f"x=(w-tw)/2:y=(h-th)/2+40:"
        f"alpha='if(lt(t,1.2),t/1.2,if(gt(t,{duration-0.5}),({duration}-t)/0.5,1))'"
    )

    run_ff([
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={COLORS['bg']}:s={RES}:d={duration}",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", vf,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-t", str(duration), "-r", str(FPS), str(output_path)
    ], "location intro")


def create_ken_burns_clip(image_path, audio_path, output_path, overlay_text="",
                          zoom_dir="in", extra_time=1.0):
    duration = get_audio_duration(str(audio_path)) + extra_time
    frames = int(duration * FPS)

    if zoom_dir == "in":
        zp = f"zoompan=z='min(zoom+0.0006,1.3)':d={frames}:s={RES}:fps={FPS}"
    elif zoom_dir == "out":
        zp = f"zoompan=z='if(eq(on,1),1.3,max(zoom-0.0006,1.0))':d={frames}:s={RES}:fps={FPS}"
    else:
        zp = f"zoompan=z='1.15':x='iw/2-(iw/zoom/2)+((iw/zoom)*0.15*sin(on/{frames}*PI))':d={frames}:s={RES}:fps={FPS}"

    safe_text = overlay_text.replace("'", "").replace(":", "").replace('"', '')

    vf = f"scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440,{zp}"

    if safe_text:
        vf += (
            f",drawtext=text='{safe_text}':fontsize=36:fontcolor={COLORS['text']}:"
            f"font=DejaVu Sans:x=60:y=h-70:"
            f"shadowcolor=black:shadowx=2:shadowy=2:"
            f"alpha='if(lt(t,1),t,if(gt(t,{duration-1}),({duration}-t),1))'"
        )

    vf += f",colorbalance=rs=0.05:gs=0.02:bs=-0.05,eq=saturation=0.85:contrast=1.05"

    run_ff([
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(image_path),
        "-i", str(audio_path),
        "-vf", vf,
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-shortest", "-r", str(FPS), str(output_path)
    ], "ken burns")


def create_multi_image_clip(images, audio_path, output_path, location_name=""):
    audio_dur = get_audio_duration(str(audio_path))
    n = len(images)
    per_image = audio_dur / n + 0.5

    segment_clips = []
    zoom_types = ["in", "out", "pan"]

    for i, img in enumerate(images):
        seg_audio = str(CACHE_DIR / "clips" / f"seg_audio_{i}.wav")
        start = i * (audio_dur / n)
        subprocess.run([
            "ffmpeg", "-y", "-i", str(audio_path),
            "-ss", str(start), "-t", str(per_image),
            "-c:a", "pcm_s16le", "-ar", "44100", str(seg_audio)
        ], capture_output=True)

        seg_clip = str(CACHE_DIR / "clips" / f"seg_clip_{i}.mp4")
        overlay = location_name if i == 0 else ""
        zoom = zoom_types[i % 3]

        try:
            create_ken_burns_clip(img, seg_audio, seg_clip, overlay, zoom, 0.5)
            segment_clips.append(seg_clip)
        except Exception:
            pass

    if not segment_clips:
        create_ken_burns_clip(images[0], str(audio_path), str(output_path), location_name)
        return

    if len(segment_clips) == 1:
        shutil.copy2(segment_clips[0], str(output_path))
        return

    crossfaded = segment_clips[0]
    for i in range(1, len(segment_clips)):
        merged = str(CACHE_DIR / "clips" / f"merged_{i}.mp4")
        d1 = get_audio_duration(crossfaded)
        offset = max(0.3, d1 - 0.8)

        try:
            run_ff([
                "ffmpeg", "-y",
                "-i", crossfaded, "-i", segment_clips[i],
                "-filter_complex",
                f"[0:v][1:v]xfade=transition=fade:duration=0.8:offset={offset}[v];"
                f"[0:a][1:a]acrossfade=d=0.8[a]",
                "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k",
                "-r", str(FPS), merged
            ], "crossfade")
            crossfaded = merged
        except Exception:
            concat_file = str(CACHE_DIR / "clips" / "seg_concat.txt")
            with open(concat_file, "w") as f:
                f.write(f"file '{crossfaded}'\n")
                f.write(f"file '{segment_clips[i]}'\n")
            run_ff([
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", concat_file,
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k",
                "-r", str(FPS), merged
            ], "concat fallback")
            crossfaded = merged

    shutil.copy2(crossfaded, str(output_path))


def add_background_music(video_path, output_path, music_path=None, volume=0.12):
    if not music_path:
        music_files = sorted(globmod.glob(str(MUSIC_DIR / "*.mp3"))) + \
                      sorted(globmod.glob(str(MUSIC_DIR / "*.wav")))
        if not music_files:
            shutil.copy2(str(video_path), str(output_path))
            return
        music_path = music_files[0]

    video_dur = get_audio_duration(str(video_path))

    try:
        run_ff([
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-stream_loop", "-1", "-i", str(music_path),
            "-filter_complex",
            f"[1:a]volume={volume},afade=t=in:st=0:d=3,"
            f"afade=t=out:st={video_dur-3}:d=3[music];"
            f"[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[a]",
            "-map", "0:v", "-map", "[a]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-t", str(video_dur), str(output_path)
        ], "background music")
    except Exception:
        shutil.copy2(str(video_path), str(output_path))


def crossfade_clips(clip_a, clip_b, output_path, fade_duration=1.0):
    dur_a = get_audio_duration(str(clip_a))
    offset = max(0.5, dur_a - fade_duration)

    try:
        run_ff([
            "ffmpeg", "-y",
            "-i", str(clip_a), "-i", str(clip_b),
            "-filter_complex",
            f"[0:v][1:v]xfade=transition=fade:duration={fade_duration}:offset={offset}[v];"
            f"[0:a][1:a]acrossfade=d={fade_duration}[a]",
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-r", str(FPS), str(output_path)
        ], "crossfade")
        return True
    except Exception:
        return False


# --- Main Pipeline ---

def generate_documentary(locations, output_name=None, lang="en"):
    ensure_dirs()
    clips_dir = CACHE_DIR / "clips"

    for f in clips_dir.glob("seg_*"):
        f.unlink()
    for f in clips_dir.glob("merged_*"):
        f.unlink()

    if not output_name:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_name = f"docu_{timestamp}.mp4"

    output_file = OUTPUT_DIR / output_name
    all_clips = []

    # --- Title ---
    log("Title sequence...")
    title_audio = CACHE_DIR / "audio" / "title.wav"
    generate_speech(
        "Hidden history. A journey through the secrets of Europe.",
        str(title_audio), lang
    )
    title_clip = clips_dir / "00_title.mp4"
    create_title_sequence("Hidden History", "The secrets of Europe", title_clip, title_audio)
    all_clips.append(str(title_clip))

    # --- Locations ---
    for i, loc in enumerate(locations):
        idx = f"{i+1:02d}"
        log(f"\nLocation {i+1}/{len(locations)}: {loc['name']}")

        # Wikipedia
        log("Fetching Wikipedia...", 1)
        wiki = fetch_wiki(loc.get("wiki", "")) if loc.get("wiki") else None
        wiki_extract = wiki.get("extract", "") if wiki else ""

        # Images
        log("Gathering images...", 1)
        images = get_location_images(loc, wiki)
        log(f"  {len(images)} images found", 1)

        # Location intro card
        log("Creating intro card...", 1)
        intro_clip = clips_dir / f"{idx}_intro.mp4"
        create_location_intro(loc["name"], loc.get("period", ""), loc.get("type", ""), intro_clip)
        all_clips.append(str(intro_clip))

        # Narration
        log("Writing narration (Llama 3.1)...", 1)
        narration = generate_narration_ollama(loc, wiki_extract)
        log(f'  "{narration[:90]}..."', 1)

        # TTS
        log("Generating speech...", 1)
        audio_path = CACHE_DIR / "audio" / f"{idx}_narration.wav"
        generate_speech(narration, str(audio_path), lang)
        dur = get_audio_duration(str(audio_path))
        log(f"  {dur:.1f}s audio", 1)

        # Video clip
        if len(images) >= 3:
            log(f"Multi-image clip ({len(images)} images)...", 1)
            clip_path = clips_dir / f"{idx}_location.mp4"
            try:
                create_multi_image_clip(images, str(audio_path), str(clip_path), loc["name"])
            except Exception as e:
                log(f"Multi-image failed ({e}), single image fallback", 1)
                zoom = ["in", "out", "pan"][i % 3]
                create_ken_burns_clip(images[0], str(audio_path), str(clip_path), loc["name"], zoom)
        else:
            log("Ken Burns clip...", 1)
            clip_path = clips_dir / f"{idx}_location.mp4"
            zoom = ["in", "out", "pan"][i % 3]
            create_ken_burns_clip(images[0], str(audio_path), str(clip_path), loc["name"], zoom)

        all_clips.append(str(clip_path))

    # --- End card ---
    log("\nEnd card...")
    end_audio = CACHE_DIR / "audio" / "end.wav"
    generate_speech("Brionicle. Discover hidden history.", str(end_audio), lang)
    end_clip = clips_dir / "99_end.mp4"
    create_title_sequence("Brionicle", "brionicle.pages.dev", end_clip, end_audio, 6)
    all_clips.append(str(end_clip))

    # --- Merge with crossfades ---
    log("\nMerging with crossfades...")
    if len(all_clips) == 1:
        shutil.copy2(all_clips[0], str(output_file))
    else:
        merged = all_clips[0]
        for i in range(1, len(all_clips)):
            next_merged = str(clips_dir / f"final_{i}.mp4")
            if not crossfade_clips(merged, all_clips[i], next_merged, 0.8):
                concat_file = str(CACHE_DIR / "concat_final.txt")
                with open(concat_file, "w") as f:
                    f.write(f"file '{merged}'\n")
                    f.write(f"file '{all_clips[i]}'\n")
                run_ff([
                    "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
                    "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k",
                    "-r", str(FPS), next_merged
                ], "concat fallback")
            merged = next_merged

        temp_no_music = str(clips_dir / "pre_music.mp4")
        shutil.copy2(merged, temp_no_music)

        # Add background music if available
        log("Adding background music...")
        add_background_music(temp_no_music, str(output_file))

    # --- Color grade final ---
    graded = str(OUTPUT_DIR / f"graded_{output_name}")
    try:
        run_ff([
            "ffmpeg", "-y", "-i", str(output_file),
            "-vf", "colorbalance=rs=0.03:gs=0.01:bs=-0.03,eq=saturation=0.9:contrast=1.03:brightness=0.02",
            "-c:v", "libx264", "-crf", "22", "-preset", "medium",
            "-c:a", "copy",
            "-movflags", "+faststart",
            graded
        ], "color grade")
        shutil.move(graded, str(output_file))
    except Exception:
        pass

    # --- Report ---
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration,size",
         "-of", "json", str(output_file)],
        capture_output=True, text=True
    )
    info = json.loads(probe.stdout)["format"]
    duration = float(info["duration"])
    size_mb = int(info["size"]) / (1024 * 1024)

    print(f"\n{'='*50}")
    print(f"  DOCUMENTARY COMPLETE")
    print(f"  File:      {output_file}")
    print(f"  Duration:  {int(duration//60)}:{int(duration%60):02d}")
    print(f"  Size:      {size_mb:.1f} MB")
    print(f"  Locations: {len(locations)}")
    print(f"  Language:  {'English' if lang == 'en' else 'Nederlands'}")
    print(f"{'='*50}\n")

    return str(output_file)


def run_test():
    log("Test mode: 3 locations\n")
    test_locations = [
        {
            "name": "Temple Church",
            "wiki": "Temple_Church",
            "type": "tempel",
            "period": "1185",
            "description": "Knights Templar church with round nave, modeled after the Church of the Holy Sepulchre"
        },
        {
            "name": "Rosslyn Chapel",
            "wiki": "Rosslyn_Chapel",
            "type": "loge",
            "period": "1446",
            "description": "Mysterious chapel filled with Masonic symbolism near Edinburgh"
        },
        {
            "name": "Catacombs of Paris",
            "wiki": "Catacombs_of_Paris",
            "type": "spook",
            "period": "18th century",
            "description": "Underground ossuary holding the remains of six million people"
        }
    ]
    return generate_documentary(test_locations, "test_docu_v2.mp4", lang="en")


def main():
    parser = argparse.ArgumentParser(description="Brionicle Documentary Generator v2")
    parser.add_argument("playlist", nargs="?", help="JSON file with locations")
    parser.add_argument("--test", action="store_true", help="Test mode with 3 locations")
    parser.add_argument("--output", "-o", help="Output filename")
    parser.add_argument("--lang", default="en", choices=["en", "nl"], help="Narration language")
    args = parser.parse_args()

    print(f"\n{'='*50}")
    print(f"  BRIONICLE DOCUMENTARY GENERATOR v2")
    print(f"  Cinematic · Multi-image · Crossfade")
    print(f"{'='*50}\n")

    if args.test:
        run_test()
        return

    if not args.playlist:
        print("Usage: python3 docu-generator-v2.py playlist.json")
        print("       python3 docu-generator-v2.py --test")
        print("       python3 docu-generator-v2.py playlist.json --lang nl")
        sys.exit(1)

    with open(args.playlist) as f:
        locations = json.load(f)

    if not locations:
        print("No locations in playlist")
        sys.exit(1)

    log(f"{len(locations)} locations loaded")
    generate_documentary(locations, args.output, args.lang)


if __name__ == "__main__":
    main()
