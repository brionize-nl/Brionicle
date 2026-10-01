#!/usr/bin/env python3
"""
Brionicle Documentary Generator
Genereert automatisch een documentaire van geselecteerde kaartlocaties.

Gebruik:
    python3 docu-generator.py playlist.json
    python3 docu-generator.py --test

Input: JSON array met locaties uit Brionicle (mysteries.json / castles.json formaat)
Output: documentaire.mp4 in ~/Brionicle/output/
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
from pathlib import Path

HOME = Path.home()
OUTPUT_DIR = HOME / "Brionicle" / "output"
CACHE_DIR = HOME / "Brionicle" / ".cache"
VOICE_DIR = HOME / ".local" / "share" / "piper-voices"
VOICE_MODEL = VOICE_DIR / "nl_NL-mls-medium.onnx"

COLORS = {
    "bg": "0x1c1408",
    "text": "#c5a55a",
    "subtext": "#a08b6c",
    "dark": "0x0f0a04",
}


def log(msg, indent=0):
    prefix = "  " * indent
    print(f"{prefix}>> {msg}")


def ensure_dirs():
    for d in [OUTPUT_DIR, CACHE_DIR, CACHE_DIR / "images", CACHE_DIR / "audio", CACHE_DIR / "clips"]:
        d.mkdir(parents=True, exist_ok=True)


def cache_path(subdir, key, ext):
    safe = hashlib.md5(key.encode()).hexdigest()[:12]
    return CACHE_DIR / subdir / f"{safe}.{ext}"


# --- Wikipedia ---

def fetch_wiki(page_name):
    for lang in ["nl", "en"]:
        url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(page_name)}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Brionicle-DocuGen/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return json.loads(resp.read())
        except Exception:
            continue
    return None


def download_image(url, filepath):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Brionicle-DocuGen/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            with open(filepath, "wb") as f:
                f.write(resp.read())
        return os.path.getsize(filepath) > 1000
    except Exception:
        return False


def get_location_image(loc, wiki_data):
    img_path = cache_path("images", loc["name"], "jpg")
    if img_path.exists() and os.path.getsize(img_path) > 1000:
        return str(img_path)

    if wiki_data and wiki_data.get("thumbnail"):
        img_url = wiki_data["thumbnail"]["source"]
        img_url = img_url.replace("/220px-", "/1024px-").replace("/320px-", "/1024px-")
        if download_image(img_url, img_path):
            return str(img_path)

    if wiki_data and wiki_data.get("originalimage"):
        if download_image(wiki_data["originalimage"]["source"], img_path):
            return str(img_path)

    return None


# --- Ollama (Llama 3.1) ---

def generate_narration_ollama(loc, wiki_extract=""):
    prompt = f"""Schrijf een korte, sfeervolle vertelling in het Nederlands voor een documentaire over de volgende historische locatie.
Maximaal 5 zinnen. Gebruik een mysterieuze, diepzinnige toon alsof je een geheim onthult.
Geen opsommingen, geen bullet points, alleen vloeiende tekst.

Locatie: {loc['name']}
Type: {loc.get('type', 'onbekend')}
Periode: {loc.get('period', 'onbekend')}
Beschrijving: {loc.get('description', '')}
Wikipedia: {wiki_extract[:500] if wiki_extract else 'niet beschikbaar'}

Vertelling:"""

    try:
        result = subprocess.run(
            ["ollama", "run", "llama3.1:8b"],
            input=prompt, capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0 and result.stdout.strip():
            text = result.stdout.strip()
            text = text.replace('"', '').replace("'", "")
            if len(text) > 50:
                return text
    except Exception as e:
        log(f"Ollama fout: {e}", 2)

    return loc.get("description", f"{loc['name']}. Een mysterieuze plek vol verborgen geschiedenis.")


# --- Piper TTS ---

def generate_speech(text, output_path):
    if VOICE_MODEL.exists():
        try:
            proc = subprocess.run(
                ["piper", "--model", str(VOICE_MODEL), "--output_file", str(output_path),
                 "--sentence_silence", "0.4"],
                input=text, capture_output=True, text=True, timeout=30
            )
            if proc.returncode == 0 and os.path.getsize(output_path) > 100:
                return True
        except Exception as e:
            log(f"Piper fout: {e}, fallback naar espeak", 2)

    subprocess.run(
        ["espeak-ng", "-v", "mb-nl2", "-s", "135", "-p", "35", "--stdout", text],
        stdout=open(output_path, "wb"), stderr=subprocess.DEVNULL
    )
    return True


def get_audio_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())


# --- FFmpeg Video ---

def create_title_card(text, subtitle, output_path, audio_path=None, duration=6):
    safe_text = text.replace("'", "").replace(":", "")
    safe_sub = subtitle.replace("'", "").replace(":", "")

    vf = (
        f"drawtext=text='{safe_text}':fontsize=72:fontcolor={COLORS['text']}:"
        f"font=DejaVu Sans:x=(w-tw)/2:y=(h-th)/2-50:"
        f"shadowcolor=black:shadowx=3:shadowy=3,"
        f"drawtext=text='{safe_sub}':fontsize=32:fontcolor={COLORS['subtext']}:"
        f"font=DejaVu Sans:x=(w-tw)/2:y=(h-th)/2+50"
    )

    cmd = ["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={COLORS['bg']}:s=1920x1080:d={duration}"]

    if audio_path:
        cmd += ["-i", str(audio_path)]
        cmd += ["-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                "-shortest", "-r", "25", str(output_path)]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-shortest", "-r", "25", str(output_path)]

    subprocess.run(cmd, capture_output=True, check=True)


def create_ken_burns_clip(image_path, audio_path, output_path, location_name, zoom_dir="in"):
    duration = get_audio_duration(audio_path) + 1.5
    frames = int(duration * 25)

    if zoom_dir == "in":
        zoompan = f"zoompan=z='min(zoom+0.0008,1.4)':d={frames}:s=1920x1080:fps=25"
    else:
        zoompan = f"zoompan=z='if(eq(on,1),1.4,max(zoom-0.0008,1.0))':d={frames}:s=1920x1080:fps=25"

    safe_name = location_name.replace("'", "").replace(":", "").replace('"', "")

    vf = (
        f"scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,"
        f"{zoompan},"
        f"drawtext=text='{safe_name}':fontsize=42:fontcolor={COLORS['text']}:"
        f"font=DejaVu Sans:x=60:y=h-80:shadowcolor=black:shadowx=2:shadowy=2"
    )

    subprocess.run([
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(image_path),
        "-i", str(audio_path),
        "-vf", vf,
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-shortest", "-r", "25", str(output_path)
    ], capture_output=True, check=True)


def create_colored_card(output_path, color=None):
    c = color or COLORS["dark"]
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={c}:s=1920x1080:d=1",
        "-frames:v", "1", str(output_path)
    ], capture_output=True, check=True)


def create_transition(output_path, duration=1.5):
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={COLORS['bg']}:s=1920x1080:d={duration}",
        "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-r", "25", str(output_path)
    ], capture_output=True, check=True)


def type_label(loc_type):
    labels = {
        "loge": "Vrijmetselaarsloge",
        "tempel": "Tempeliers",
        "kerk": "Kerk / Basiliek",
        "spook": "Paranormale locatie",
        "kasteel": "Kasteel",
        "ruine": "Ruine",
        "fort": "Fort",
        "paleis": "Paleis",
        "burcht": "Burcht",
    }
    return labels.get(loc_type, loc_type or "Locatie")


# --- Main Pipeline ---

def generate_documentary(locations, output_name=None):
    ensure_dirs()
    clips_dir = CACHE_DIR / "clips"

    if not output_name:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_name = f"docu_{timestamp}.mp4"

    output_file = OUTPUT_DIR / output_name
    clips = []

    log("Titelkaart genereren...")
    title_audio = CACHE_DIR / "audio" / "title.wav"
    generate_speech("Verborgen geschiedenis. Een reis langs de geheimen van Europa.", str(title_audio))
    title_clip = clips_dir / "00_title.mp4"
    create_title_card("Verborgen Geschiedenis", "Een reis langs de geheimen van Europa",
                      title_clip, title_audio)
    clips.append(str(title_clip))

    transition = clips_dir / "transition.mp4"
    create_transition(transition)

    for i, loc in enumerate(locations):
        idx = f"{i+1:02d}"
        log(f"Locatie {i+1}/{len(locations)}: {loc['name']}")

        # Wikipedia
        log("Wikipedia ophalen...", 1)
        wiki = fetch_wiki(loc.get("wiki", "")) if loc.get("wiki") else None
        wiki_extract = (wiki.get("extract", "") if wiki else "")

        # Image
        log("Afbeelding zoeken...", 1)
        img_path = get_location_image(loc, wiki)
        if not img_path:
            log("Geen afbeelding gevonden, gekleurde kaart", 1)
            img_path = str(CACHE_DIR / "images" / f"{idx}_fallback.png")
            create_colored_card(img_path, "0x2c1e0f")

        # Narration script (Ollama)
        log("Vertelling schrijven (Llama 3.1)...", 1)
        narration = generate_narration_ollama(loc, wiki_extract)
        log(f'  "{narration[:80]}..."', 1)

        # TTS
        log("Vertelling inspreken (Piper)...", 1)
        audio_path = CACHE_DIR / "audio" / f"{idx}_narration.wav"
        generate_speech(narration, str(audio_path))
        dur = get_audio_duration(str(audio_path))
        log(f"  {dur:.1f}s audio", 1)

        # Video clip
        log("Ken Burns clip renderen...", 1)
        clip_path = clips_dir / f"{idx}_{loc['name'][:20].replace(' ', '_')}.mp4"
        zoom = "in" if i % 2 == 0 else "out"
        try:
            create_ken_burns_clip(img_path, str(audio_path), clip_path, loc["name"], zoom)
            clips.append(str(transition))
            clips.append(str(clip_path))
        except subprocess.CalledProcessError as e:
            log(f"Ken Burns mislukt, simpele clip maken...", 1)
            # Fallback: static image with audio
            subprocess.run([
                "ffmpeg", "-y", "-loop", "1", "-i", img_path,
                "-i", str(audio_path),
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
                "-shortest", "-r", "25", str(clip_path)
            ], capture_output=True)
            clips.append(str(transition))
            clips.append(str(clip_path))

        log("")

    # End card
    log("Eindkaart genereren...")
    end_audio = CACHE_DIR / "audio" / "end.wav"
    generate_speech("Brionicle. Ontdek de verborgen geschiedenis.", str(end_audio))
    end_clip = clips_dir / "99_end.mp4"
    create_title_card("Brionicle", "brionicle.pages.dev", end_clip, end_audio, 5)
    clips.append(str(transition))
    clips.append(str(end_clip))

    # Concatenate
    log("Alles samenvoegen...")
    concat_file = CACHE_DIR / "concat.txt"
    with open(concat_file, "w") as f:
        for clip in clips:
            f.write(f"file '{clip}'\n")

    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-c:v", "libx264", "-crf", "23", "-preset", "medium",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        str(output_file)
    ], capture_output=True, check=True)

    # Report
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration,size",
         "-of", "json", str(output_file)],
        capture_output=True, text=True
    )
    info = json.loads(probe.stdout)["format"]
    duration = float(info["duration"])
    size_mb = int(info["size"]) / (1024 * 1024)

    print(f"\n{'='*50}")
    print(f"  DOCUMENTAIRE KLAAR")
    print(f"  Bestand:  {output_file}")
    print(f"  Duur:     {int(duration//60)}:{int(duration%60):02d}")
    print(f"  Grootte:  {size_mb:.1f} MB")
    print(f"  Locaties: {len(locations)}")
    print(f"{'='*50}\n")

    return str(output_file)


def run_test():
    log("Testmodus: 2 locaties")
    test_locations = [
        {
            "name": "Rosslyn Chapel",
            "wiki": "Rosslyn_Chapel",
            "type": "loge",
            "period": "1446",
            "description": "Mysterieuze kapel vol vrijmetselaarssymboliek bij Edinburgh"
        },
        {
            "name": "Catacomben van Parijs",
            "wiki": "Catacomben_van_Parijs",
            "type": "spook",
            "period": "18e eeuw",
            "description": "Ondergronds ossuarium met de resten van zes miljoen mensen"
        }
    ]
    return generate_documentary(test_locations, "test_docu.mp4")


def main():
    parser = argparse.ArgumentParser(description="Brionicle Documentary Generator")
    parser.add_argument("playlist", nargs="?", help="JSON bestand met locaties")
    parser.add_argument("--test", action="store_true", help="Testmodus met 2 locaties")
    parser.add_argument("--output", "-o", help="Naam van het outputbestand")
    args = parser.parse_args()

    print(f"\n{'='*50}")
    print(f"  BRIONICLE DOCUMENTAIRE GENERATOR")
    print(f"{'='*50}\n")

    if args.test:
        run_test()
        return

    if not args.playlist:
        print("Gebruik: python3 docu-generator.py playlist.json")
        print("         python3 docu-generator.py --test")
        sys.exit(1)

    with open(args.playlist) as f:
        locations = json.load(f)

    if not locations:
        print("Geen locaties in playlist")
        sys.exit(1)

    log(f"{len(locations)} locaties geladen")
    generate_documentary(locations, args.output)


if __name__ == "__main__":
    main()
