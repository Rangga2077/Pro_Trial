"""
benchmark_assistant.py
----------------------
Offline benchmark for the planned "Ask Jenny" voice assistant. Not part of the app.
Measures speech-to-text (faster-whisper on CPU) accuracy and speed under kitchen
noise, and local LLM (Ollama) latency, then writes a GO / NO-GO report.

Questions live in backend/scripts/assistant_questions.json. Audio goes to
data/bench_audio/, raw results and reports to data/bench_results/.

Usage:
  python backend/scripts/benchmark_assistant.py record --question-id q01 --condition quiet
  python backend/scripts/benchmark_assistant.py record --question-id q01 --condition crowded --device 1 --speaker anna
  python backend/scripts/benchmark_assistant.py stt --models base.en small.en
  python backend/scripts/benchmark_assistant.py llm --model llama3.2:3b --runs 2
  python backend/scripts/benchmark_assistant.py gpu
  python backend/scripts/benchmark_assistant.py report
"""

import argparse
import importlib
import json
import re
import shutil
import statistics
import subprocess
import sys
import time
import wave
from datetime import datetime
from pathlib import Path
from types import ModuleType
from typing import Any, NoReturn

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.config import settings  # noqa: E402  (reads backend/.env)

QUESTIONS_FILE = Path(__file__).resolve().parent / "assistant_questions.json"
AUDIO_DIR = PROJECT_ROOT / "data" / "bench_audio"
RESULTS_DIR = PROJECT_ROOT / "data" / "bench_results"

SAMPLE_RATE = 16000
CONDITIONS = ("quiet", "crowded", "running_water", "hud_music")
NOISY_CONDITIONS = ("crowded", "running_water", "hud_music")

LISTEN_SECONDS = 6.0
MAX_END_TO_END_SECONDS = 12.0
MIN_USABLE_RATE = 0.80

VOCAB_CHOICES = ("none", "cooking", "recipe", "both")
COOKING_PROMPT = (
    "Cooking questions: stir-fry, al dente, tablespoon, teaspoon, cornstarch slurry, "
    "dumplings, simmer, marinate, wok, substitute, instead of."
)
TRANSCRIPTS_HEADING = "### Transcripts (rate Usable Y/N here): "

SYSTEM_PROMPT = (
    "You are Jenny, a kitchen assistant. Answer in at most 40 words, plain English, "
    "no lists. If the question is not about cooking, say you can only help with cooking."
)
OLLAMA_OPTIONS = {"num_ctx": 2048, "num_predict": 120, "temperature": 0.3}

NOISE_FIXES = {
    "crowded": "move the mic closer to the speaker and away from the crowd noise, or try a bigger STT model (small.en -> medium.en)",
    "running_water": "move the mic away from the sink, or try a bigger STT model (small.en -> medium.en)",
    "hud_music": "lower the HUD music while listening, or try a bigger STT model (small.en -> medium.en)",
}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def fail(message: str) -> NoReturn:
    print(f"[ERROR] {message}")
    sys.exit(1)


def require(module: str, pip_name: str) -> ModuleType:
    """Import an optional dependency, or exit with an install hint instead of a traceback."""
    try:
        return importlib.import_module(module)
    except (ImportError, OSError) as exc:
        fail(f"'{module}' is not available ({exc}). Install it with: backend\\venv\\Scripts\\pip install {pip_name}")


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def load_questions() -> list[dict[str, Any]]:
    return json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))


def find_question(questions: list[dict[str, Any]], question_id: str) -> dict[str, Any]:
    for question in questions:
        if question["id"] == question_id:
            return question
    fail(f"Unknown question id '{question_id}'. Valid ids: {', '.join(q['id'] for q in questions)}")


def save_results(prefix: str, data: dict[str, Any]) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path = RESULTS_DIR / f"{prefix}_{timestamp()}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def median(values: list[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    return statistics.median(present) if present else None


def mean(values: list[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    return statistics.fmean(present) if present else None


def fmt(value: float | None, digits: int = 2) -> str:
    return "–" if value is None else f"{value:.{digits}f}"


# ---------------------------------------------------------------------------
# record
# ---------------------------------------------------------------------------

def safe_name(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9-]+", "-", text).strip("-") or "speaker"


def unique_wav_path(stem: str) -> Path:
    """data/bench_audio/<stem>.wav, or <stem>_2.wav, _3 ... if taken. Never overwrites."""
    path = AUDIO_DIR / f"{stem}.wav"
    suffix = 2
    while path.exists() or path.with_suffix(".json").exists():
        path = AUDIO_DIR / f"{stem}_{suffix}.wav"
        suffix += 1
    return path


def write_wav(path: Path, samples: bytes) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)  # int16
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(samples)


def countdown() -> None:
    for n in (3, 2, 1):
        print(f"  {n}...", flush=True)
        time.sleep(1)
    print("  SPEAK NOW", flush=True)


def cmd_record(args: argparse.Namespace) -> None:
    sd = require("sounddevice", "sounddevice")
    question = find_question(load_questions(), args.question_id)
    device = args.device if args.device is not None else settings.VOICE_DEVICE_INDEX
    speaker = safe_name(args.speaker)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    wav_path = unique_wav_path(f"{args.condition}_{question['id']}_{speaker}")

    print(f"\n[{args.condition}] {question['id']}: \"{question['question']}\"")
    print(f"  mic: {device if device is not None else 'system default'} | {args.seconds:g} s")
    countdown()
    try:
        audio = sd.rec(int(args.seconds * SAMPLE_RATE), samplerate=SAMPLE_RATE,
                       channels=1, dtype="int16", device=device)
        sd.wait()
    except (sd.PortAudioError, ValueError) as exc:
        fail(f"Could not record from microphone '{device}': {exc}. List devices with: backend\\venv\\Scripts\\python -m sounddevice")

    write_wav(wav_path, audio.tobytes())
    sidecar = {
        "expected": question["question"],
        "condition": args.condition,
        "speaker": speaker,
        "question_id": question["id"],
    }
    wav_path.with_suffix(".json").write_text(json.dumps(sidecar, indent=2), encoding="utf-8")
    print(f"saved {wav_path}")


# ---------------------------------------------------------------------------
# stt
# ---------------------------------------------------------------------------

def normalize(text: str) -> list[str]:
    """Lowercase words without punctuation; apostrophes inside words stay (what's)."""
    text = re.sub(r"[^\w\s']", " ", text.lower().replace("’", "'"))
    return [word.strip("'") for word in text.split() if word.strip("'")]


def word_error_rate(expected: str, heard: str) -> float:
    """Word-level Levenshtein distance divided by the number of expected words."""
    ref, hyp = normalize(expected), normalize(heard)
    if not ref:
        return 0.0 if not hyp else 1.0
    previous = list(range(len(hyp) + 1))
    for i, ref_word in enumerate(ref, start=1):
        current = [i]
        for j, hyp_word in enumerate(hyp, start=1):
            current.append(min(
                previous[j] + 1,                            # deletion
                current[j - 1] + 1,                         # insertion
                previous[j - 1] + (ref_word != hyp_word),   # substitution
            ))
        previous = current
    return previous[-1] / len(ref)


def condition_from_name(stem: str) -> str:
    return next((c for c in CONDITIONS if stem.startswith(f"{c}_")), "unknown")


def load_clips() -> list[dict[str, Any]]:
    clips = []
    for wav_path in sorted(AUDIO_DIR.glob("*.wav")):
        sidecar = wav_path.with_suffix(".json")
        if sidecar.exists():
            meta = json.loads(sidecar.read_text(encoding="utf-8"))
        else:
            print(f"[WARN] {wav_path.name} has no sidecar .json; WER will be skipped.")
            meta = {"expected": None, "condition": condition_from_name(wav_path.stem),
                    "speaker": None, "question_id": None}
        clips.append({"path": wav_path, **meta})
    return clips


def audio_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / wav.getframerate()


def load_samples(path: Path) -> Any:
    """16 kHz mono int16 WAV -> float32 array in [-1, 1]. Passing samples instead of the
    path skips faster-whisper's PyAV decoder (PyAV 19 rejects its open() arguments)."""
    import numpy as np

    with wave.open(str(path), "rb") as wav:
        if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) != (SAMPLE_RATE, 1, 2):
            fail(f"{path.name} is not 16 kHz mono 16-bit. Re-record it with the 'record' command.")
        frames = wav.readframes(wav.getnframes())
    return np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0


def load_whisper(faster_whisper: ModuleType, name: str) -> tuple[Any, float]:
    start = time.perf_counter()
    try:
        model = faster_whisper.WhisperModel(name, device="cpu", compute_type="int8")
    except Exception as exc:  # download / file errors from the model hub
        fail(f"Could not load Whisper model '{name}': {exc}. "
             "The first use downloads it from Hugging Face, so check the internet connection once.")
    return model, time.perf_counter() - start


def recipe_hotwords(questions: list[dict[str, Any]]) -> dict[str, str]:
    """question_id -> "<recipe title>, <ingredient names>" for faster-whisper hotwords."""
    hotwords = {}
    for question in questions:
        recipe = load_recipe(question["recipe_id"])
        names = [recipe["title"]] + [item["name"] for item in recipe.get("ingredients", [])]
        hotwords[question["id"]] = ", ".join(names)
    return hotwords


def vocab_options(vocab: str, question_id: str | None, hotwords: dict[str, str]) -> dict[str, str]:
    """Extra transcribe() arguments: cooking initial_prompt, recipe hotwords, both or none."""
    options = {}
    if vocab in ("cooking", "both"):
        options["initial_prompt"] = COOKING_PROMPT
    if vocab in ("recipe", "both") and question_id in hotwords:
        options["hotwords"] = hotwords[question_id]
    return options


def transcribe(model: Any, path: Path, options: dict[str, str]) -> tuple[str, float]:
    samples = load_samples(path)
    start = time.perf_counter()
    segments, _info = model.transcribe(samples, language="en", vad_filter=True, beam_size=1, **options)
    text = " ".join(segment.text.strip() for segment in segments).strip()  # consumes the generator
    return text, time.perf_counter() - start


def cmd_stt(args: argparse.Namespace) -> None:
    faster_whisper = require("faster_whisper", "faster-whisper")
    clips = load_clips()
    if not clips:
        fail(f"No .wav clips in {AUDIO_DIR}. Record some first with the 'record' command.")

    vocabs = list(dict.fromkeys(args.vocab))
    hotwords = recipe_hotwords(load_questions()) if {"recipe", "both"} & set(vocabs) else {}
    if hotwords:
        no_recipe = [c["path"].name for c in clips if c["question_id"] not in hotwords]
        if no_recipe:
            print(f"[WARN] no question id, so no recipe hotwords for: {', '.join(no_recipe)}")

    results: dict[str, Any] = {"created": timestamp(), "load_seconds": {}, "vocabs": vocabs, "clips": []}
    for name in args.models:
        print(f"\n[STT] loading {name} ...")
        model, load_s = load_whisper(faster_whisper, name)
        results["load_seconds"][name] = load_s
        print(f"[STT] {name} loaded in {load_s:.2f} s; transcribing {len(clips)} clips x vocab {', '.join(vocabs)}")
        for vocab in vocabs:
            for clip in clips:
                options = vocab_options(vocab, clip["question_id"], hotwords)
                heard, seconds = transcribe(model, clip["path"], options)
                duration = audio_seconds(clip["path"])
                wer = word_error_rate(clip["expected"], heard) if clip["expected"] else None
                results["clips"].append({
                    "model": name,
                    "vocab": vocab,
                    "file": clip["path"].name,
                    "condition": clip["condition"],
                    "speaker": clip["speaker"],
                    "question_id": clip["question_id"],
                    "expected": clip["expected"],
                    "transcript": heard,
                    "seconds": seconds,
                    "audio_seconds": duration,
                    "rtf": seconds / duration if duration else None,
                    "wer": wer,
                })
                print(f"  {vocab:<7} {clip['path'].name:<40} {seconds:5.2f} s  WER {fmt(wer)}  | {heard}")

    print(f"\nsaved {save_results('stt', results)}")


# ---------------------------------------------------------------------------
# gpu
# ---------------------------------------------------------------------------

def gpu_snapshot() -> str:
    exe = shutil.which("nvidia-smi")
    if not exe:
        return "no NVIDIA GPU found"
    try:
        result = subprocess.run(
            [exe, "--query-gpu=memory.used,memory.total,utilization.gpu", "--format=csv"],
            capture_output=True, text=True, timeout=15,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return f"nvidia-smi failed: {exc}"
    return result.stdout.strip() or result.stderr.strip()


def cmd_gpu(_args: argparse.Namespace) -> None:
    print(gpu_snapshot())


# ---------------------------------------------------------------------------
# llm
# ---------------------------------------------------------------------------

def load_recipe(recipe_id: str) -> dict[str, Any]:
    path = Path(settings.RECIPE_DATA_DIR) / f"{recipe_id}.json"
    if not path.exists():
        fail(f"Recipe '{recipe_id}' not found at {path}. Fix {QUESTIONS_FILE.name}.")
    return json.loads(path.read_text(encoding="utf-8"))


def format_amount(amount: Any) -> str:
    return f"{amount:g}" if isinstance(amount, (int, float)) else str(amount or "")


def build_messages(question: dict[str, Any], recipe: dict[str, Any]) -> list[dict[str, str]]:
    ingredients = "; ".join(
        " ".join(part for part in (item["name"], format_amount(item.get("amount")), item.get("unit", "")) if part)
        for item in recipe.get("ingredients", [])
    )
    steps = recipe.get("instructions", [])
    index = question["step_index"]
    if not 0 <= index < len(steps):
        fail(f"{question['id']}: step_index {index} is out of range for '{recipe['id']}' ({len(steps)} steps).")
    system = (
        f"{SYSTEM_PROMPT}\n"
        f"Recipe: {recipe['title']}\n"
        f"Ingredients: {ingredients}\n"
        f"Current step: {steps[index]['description']}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": question["question"]}]


def check_ollama(httpx: ModuleType, client: Any, base_url: str, model: str) -> None:
    """Exit with a clear message if Ollama is down or the model is not pulled."""
    try:
        response = client.get(f"{base_url}/api/tags", timeout=5.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        fail(f"Ollama is not reachable at {base_url} ({exc}). Start it with: ollama serve")
    names = {entry.get("name") for entry in response.json().get("models", [])}
    if model not in names and f"{model}:latest" not in names:
        fail(f"Ollama has no model '{model}'. Pull it with: ollama pull {model}")


def chat(httpx: ModuleType, client: Any, base_url: str, model: str,
         messages: list[dict[str, str]]) -> dict[str, Any]:
    """One streamed /api/chat call: answer text, time to first token, total time, tokens/s."""
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "keep_alive": "30m",
        "options": OLLAMA_OPTIONS,
    }
    start = time.perf_counter()
    ttft: float | None = None
    parts: list[str] = []
    final: dict[str, Any] = {}
    try:
        with client.stream("POST", f"{base_url}/api/chat", json=payload) as response:
            if response.status_code != 200:
                fail(f"Ollama returned {response.status_code}: {response.read().decode(errors='replace')}")
            for line in response.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                if "error" in chunk:
                    fail(f"Ollama error: {chunk['error']}")
                content = chunk.get("message", {}).get("content", "")
                if content and ttft is None:
                    ttft = time.perf_counter() - start
                parts.append(content)
                if chunk.get("done"):
                    final = chunk
                    break
    except httpx.HTTPError as exc:
        fail(f"Lost connection to Ollama at {base_url}: {exc}")
    total = time.perf_counter() - start

    eval_count = final.get("eval_count")
    eval_duration = final.get("eval_duration")  # nanoseconds
    return {
        "answer": "".join(parts).strip(),
        "ttft": ttft,
        "total": total,
        "eval_count": eval_count,
        "eval_duration": eval_duration,
        "tokens_per_second": eval_count / (eval_duration / 1e9) if eval_count and eval_duration else None,
    }


def cmd_llm(args: argparse.Namespace) -> None:
    httpx = require("httpx", "httpx")
    base_url = settings.OLLAMA_BASE_URL.rstrip("/")
    questions = load_questions()
    prepared = [(q, build_messages(q, load_recipe(q["recipe_id"]))) for q in questions]

    gpu_before = gpu_snapshot()
    print(f"[GPU before]\n{gpu_before}\n")

    with httpx.Client(timeout=120.0) as client:
        check_ollama(httpx, client, base_url, args.model)
        print(f"[LLM] warm-up call to {args.model} (excluded) ...")
        chat(httpx, client, base_url, args.model, prepared[0][1])

        records = []
        for run in range(1, args.runs + 1):
            for question, messages in prepared:
                result = chat(httpx, client, base_url, args.model, messages)
                records.append({
                    "id": question["id"],
                    "question": question["question"],
                    "recipe_id": question["recipe_id"],
                    "step_index": question["step_index"],
                    "run": run,
                    **result,
                })
                print(f"  run {run} {question['id']}  TTFT {fmt(result['ttft'])} s  total {result['total']:.2f} s  "
                      f"{fmt(result['tokens_per_second'], 1)} tok/s | {result['answer']}")

    gpu_after = gpu_snapshot()
    print(f"\n[GPU after]\n{gpu_after}")
    data = {
        "created": timestamp(),
        "model": args.model,
        "runs": args.runs,
        "options": OLLAMA_OPTIONS,
        "gpu_before": gpu_before,
        "gpu_after": gpu_after,
        "results": records,
    }
    print(f"\nsaved {save_results('llm', data)}")


# ---------------------------------------------------------------------------
# report
# ---------------------------------------------------------------------------

def latest_results(prefix: str) -> tuple[Path, dict[str, Any]] | None:
    files = sorted(RESULTS_DIR.glob(f"{prefix}_*.json"))
    if not files:
        return None
    return files[-1], json.loads(files[-1].read_text(encoding="utf-8"))


def md_cell(text: Any) -> str:
    return str(text if text is not None else "").replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def conditions_in(clips: list[dict[str, Any]]) -> list[str]:
    extra = sorted({c["condition"] for c in clips} - set(CONDITIONS))
    return list(CONDITIONS) + extra


def vocab_of(clip: dict[str, Any]) -> str:
    return clip.get("vocab", "none")  # stt results from before --vocab existed


def variants(clips: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """(model, vocab) pairs in run order."""
    return list(dict.fromkeys((c["model"], vocab_of(c)) for c in clips))


def mark_key(model: str, vocab: str, file: str, heard_cell: str) -> tuple[str, str, str, str]:
    return model, vocab, file, heard_cell.strip()


def read_usable_marks(report: Path) -> dict[tuple[str, str, str, str], str]:
    """Y/N marks typed into the Transcripts tables of an earlier report, keyed by
    model, vocab, file and transcript (a changed transcript needs a new rating)."""
    marks: dict[tuple[str, str, str, str], str] = {}
    variant: tuple[str, str] | None = None
    for line in report.read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            match = re.match(rf"^{re.escape(TRANSCRIPTS_HEADING)}(\S+) · vocab (\S+)$", line.strip())
            variant = (match.group(1), match.group(2)) if match else None
            continue
        if variant is None or not line.lstrip().startswith("|"):
            continue
        cells = [cell.strip() for cell in re.split(r"(?<!\\)\|", line.strip())[1:-1]]
        if len(cells) != 6 or cells[0] == "File" or set(cells[0]) <= set("-: "):
            continue
        usable = cells[3].upper()
        if usable in ("Y", "N"):
            marks[mark_key(*variant, cells[0], cells[5])] = usable
    return marks


def usable_of(clip: dict[str, Any], marks: dict[tuple[str, str, str, str], str]) -> str | None:
    return marks.get(mark_key(clip["model"], vocab_of(clip), clip["file"], md_cell(clip["transcript"])))


def usable_counts(rows: list[dict[str, Any]], marks: dict[tuple[str, str, str, str], str]) -> tuple[int, int]:
    """(rated, usable) among rows."""
    ratings = [usable_of(r, marks) for r in rows]
    return sum(r is not None for r in ratings), ratings.count("Y")


def usable_summary(rows: list[dict[str, Any]], marks: dict[tuple[str, str, str, str], str]) -> str:
    rated, usable = usable_counts(rows, marks)
    if not rated:
        return ""
    unrated = f" · {len(rows) - rated} unrated" if rated < len(rows) else ""
    return f"{usable}/{rated} ({usable / rated:.0%}){unrated}"


def stt_section(path: Path, data: dict[str, Any], marks: dict[tuple[str, str, str, str], str]) -> list[str]:
    clips = data["clips"]
    loads = ", ".join(f"{m} {s:.2f} s" for m, s in data["load_seconds"].items())
    lines = [
        "## Speech-to-text",
        "",
        f"Source: `{path.name}` · model load time: {loads}",
        "",
        "Usable = the transcript keeps the question's meaning (rated by hand in the Transcripts tables below).",
        "",
        "| Model | Vocab | Condition | Clips | Median s | Median RTF | Mean WER | Usable |",
        "|---|---|---|---:|---:|---:|---:|---|",
    ]
    for model, vocab in variants(clips):
        for condition in conditions_in(clips):
            rows = [c for c in clips if c["model"] == model and vocab_of(c) == vocab and c["condition"] == condition]
            lines.append(
                f"| {model} | {vocab} | {condition} | {len(rows)} | {fmt(median([r['seconds'] for r in rows]))} | "
                f"{fmt(median([r['rtf'] for r in rows]))} | {fmt(mean([r['wer'] for r in rows]))} | "
                f"{usable_summary(rows, marks)} |"
            )
    for model, vocab in variants(clips):
        lines += ["", f"### Worst transcripts: {model} · vocab {vocab}", "",
                  "Read-only; rate clips in the Transcripts tables below."]
        for condition in conditions_in(clips):
            rows = [c for c in clips if c["model"] == model and vocab_of(c) == vocab
                    and c["condition"] == condition and c["wer"] is not None]
            if not rows:
                continue
            worst = sorted(rows, key=lambda r: r["wer"], reverse=True)[:3]
            lines += ["", f"**{condition}**", "", "| WER | Usable | Expected | Heard |", "|---:|---|---|---|"]
            lines += [f"| {r['wer']:.2f} | {usable_of(r, marks) or ''} | {md_cell(r['expected'])} | "
                      f"{md_cell(r['transcript'])} |" for r in worst]
    lines += [
        "",
        "## Transcripts",
        "",
        "Fill **Usable** with `Y` (keeps the question's meaning) or `N` in the newest report, save it, "
        "then run `report` again. Ratings carry over to the new report while the transcript is unchanged.",
    ]
    order = {condition: i for i, condition in enumerate(conditions_in(clips))}
    for model, vocab in variants(clips):
        rows = sorted((c for c in clips if c["model"] == model and vocab_of(c) == vocab),
                      key=lambda r: (order[r["condition"]], r["file"]))
        lines += ["", f"{TRANSCRIPTS_HEADING}{model} · vocab {vocab}", "",
                  "| File | Condition | WER | Usable | Expected | Heard |", "|---|---|---:|---|---|---|"]
        lines += [f"| {r['file']} | {r['condition']} | {fmt(r['wer'])} | {usable_of(r, marks) or ''} | "
                  f"{md_cell(r['expected'])} | {md_cell(r['transcript'])} |" for r in rows]
    return lines


def llm_section(path: Path, data: dict[str, Any]) -> list[str]:
    results = data["results"]
    lines = [
        "## LLM",
        "",
        f"Source: `{path.name}` · model `{data['model']}` · {data['runs']} run(s) per question · warm-up excluded",
        "",
        "| Median TTFT s | Median total s | Median tokens/s |",
        "|---:|---:|---:|",
        f"| {fmt(median([r['ttft'] for r in results]))} | {fmt(median([r['total'] for r in results]))} | "
        f"{fmt(median([r['tokens_per_second'] for r in results]), 1)} |",
        "",
        "GPU before:",
        "```",
        data["gpu_before"],
        "```",
        "GPU after:",
        "```",
        data["gpu_after"],
        "```",
        "",
        "### Answers (rate relevance by hand)",
        "",
        "| ID | Question | Run | TTFT s | Total s | Answer | Relevance 1-3 |",
        "|---|---|---:|---:|---:|---|---|",
    ]
    lines += [
        f"| {r['id']} | {md_cell(r['question'])} | {r['run']} | {fmt(r['ttft'])} | {fmt(r['total'])} | "
        f"{md_cell(r['answer'])} |  |"
        for r in results
    ]
    return lines


def verdict(stt_median: float | None, llm_median: float | None,
            noisy_usable: dict[str, tuple[int, int, int]]) -> tuple[str, list[str]]:
    """GO / NO-GO / INCOMPLETE plus the reasons, each with a suggested fix.
    noisy_usable maps each noisy condition to (clips, rated, usable)."""
    failures: list[str] = []
    missing: list[str] = []
    for condition in NOISY_CONDITIONS:
        clips, rated, usable = noisy_usable.get(condition, (0, 0, 0))
        if clips == 0:
            missing.append(f"no clips for {condition}: record them")
        elif rated < clips:
            missing.append(f"{condition}: {clips - rated} of {clips} clips not rated: "
                           "fill Usable in the Transcripts table, then run report again")
        elif usable / rated < MIN_USABLE_RATE:
            failures.append(f"{condition}: usable {usable}/{rated} ({usable / rated:.0%}) < {MIN_USABLE_RATE:.0%}. "
                            f"Fix: {NOISE_FIXES[condition]}")
    if stt_median is None or llm_median is None:
        missing.append("LLM results missing: run `llm`" if llm_median is None else "no STT timings")
    else:
        total = LISTEN_SECONDS + stt_median + llm_median
        if total > MAX_END_TO_END_SECONDS:
            failures.append(f"end-to-end {total:.1f} s > {MAX_END_TO_END_SECONDS:g} s. "
                            "Fix: use a faster STT model, a shorter listening window, or stop listening on silence")
    if failures:
        return "NO-GO", failures + missing
    if missing:
        return "INCOMPLETE", missing
    return "GO", []


def summary_section(stt: dict[str, Any], llm: dict[str, Any] | None,
                    marks: dict[tuple[str, str, str, str], str]) -> tuple[list[str], list[str]]:
    llm_median = median([r["total"] for r in llm["results"]]) if llm else None
    lines = [
        "## End-to-end estimate",
        "",
        f"{LISTEN_SECONDS:g} s listening + median STT + median LLM total.",
        "",
        "| STT model | Vocab | Listening s | STT s | LLM s | Total s |",
        "|---|---|---:|---:|---:|---:|",
    ]
    verdict_lines = [
        "## Verdict",
        "",
        f"GO = end-to-end <= {MAX_END_TO_END_SECONDS:g} s and usable >= {MIN_USABLE_RATE:.0%} "
        f"in each noisy condition ({', '.join(NOISY_CONDITIONS)}). WER is shown for information only.",
        "",
    ]
    for model, vocab in variants(stt["clips"]):
        clips = [c for c in stt["clips"] if c["model"] == model and vocab_of(c) == vocab]
        stt_median = median([c["seconds"] for c in clips])
        total = LISTEN_SECONDS + stt_median + llm_median if stt_median is not None and llm_median is not None else None
        lines.append(f"| {model} | {vocab} | {LISTEN_SECONDS:g} | {fmt(stt_median)} | {fmt(llm_median)} | {fmt(total, 1)} |")
        noisy_usable = {}
        for condition in NOISY_CONDITIONS:
            rows = [c for c in clips if c["condition"] == condition]
            noisy_usable[condition] = (len(rows), *usable_counts(rows, marks))
        status, reasons = verdict(stt_median, llm_median, noisy_usable)
        verdict_lines.append(f"- **{model} · vocab {vocab}: {status}**")
        verdict_lines += [f"  - {reason}" for reason in reasons]
    return lines, verdict_lines


def cmd_report(_args: argparse.Namespace) -> None:
    stt = latest_results("stt")
    llm = latest_results("llm")
    if stt is None and llm is None:
        fail(f"No results in {RESULTS_DIR}. Run 'stt' and 'llm' first.")

    previous = sorted(RESULTS_DIR.glob("assistant_*.md"))
    marks = read_usable_marks(previous[-1]) if previous else {}
    if marks:
        print(f"[REPORT] carried over {len(marks)} Usable rating(s) from {previous[-1].name}")

    lines = [f"# Ask Jenny benchmark ({datetime.now():%Y-%m-%d %H:%M})", ""]
    lines += stt_section(*stt, marks) if stt else ["## Speech-to-text", "", "Not run yet: run `stt`."]
    lines.append("")
    lines += llm_section(*llm) if llm else ["## LLM", "", "Not run yet: run `llm`."]
    lines.append("")
    if stt:
        estimate, verdict_lines = summary_section(stt[1], llm[1] if llm else None, marks)
        lines += estimate + [""] + verdict_lines
    else:
        lines += ["## Verdict", "", "Needs STT results: run `stt`."]

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = RESULTS_DIR / f"assistant_{timestamp()}.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    if stt:
        print("\n".join(line for line in lines if line.startswith(("- **", "  - "))))
    print(f"\nreport written to {out}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Offline benchmark for the Ask Jenny voice assistant.")
    sub = parser.add_subparsers(dest="command", required=True)

    record = sub.add_parser("record", help="Record one question from the microphone.")
    record.add_argument("--question-id", required=True, help="Id from assistant_questions.json, e.g. q01.")
    record.add_argument("--condition", required=True, choices=CONDITIONS, help="Background noise during the take.")
    record.add_argument("--seconds", type=float, default=LISTEN_SECONDS, help="Recording length (default: 6).")
    record.add_argument("--device", type=int, default=None,
                        help="Input device index (default: VOICE_DEVICE_INDEX from backend/.env).")
    record.add_argument("--speaker", default="s1", help="Speaker name used in the file name (default: s1).")
    record.set_defaults(func=cmd_record)

    stt = sub.add_parser("stt", help="Transcribe every clip in data/bench_audio with faster-whisper.")
    stt.add_argument("--models", nargs="+", default=["base.en", "small.en"],
                     help="Whisper model names (default: base.en small.en).")
    stt.add_argument("--vocab", nargs="+", choices=VOCAB_CHOICES, default=["none"],
                     help="Vocabulary hints to compare: none, cooking (initial prompt), recipe (hotwords "
                          "from the clip's recipe), both (default: none).")
    stt.set_defaults(func=cmd_stt)

    llm = sub.add_parser("llm", help="Time the local Ollama model on every question.")
    llm.add_argument("--model", default="llama3.2:3b", help="Ollama model (default: llama3.2:3b).")
    llm.add_argument("--runs", type=int, default=2, help="Runs per question (default: 2).")
    llm.set_defaults(func=cmd_llm)

    gpu = sub.add_parser("gpu", help="Print NVIDIA GPU memory and utilization.")
    gpu.set_defaults(func=cmd_gpu)

    report = sub.add_parser("report", help="Write a markdown report from the latest results.")
    report.set_defaults(func=cmd_report)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)


if __name__ == "__main__":
    main()
