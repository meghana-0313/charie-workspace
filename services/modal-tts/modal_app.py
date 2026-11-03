# Charie voice on Modal: natural male text-to-speech for Meet calls.
#
# Kokoro-82M (open weights, Apache-2.0) with the warm American male voice
# am_michael. Runs on CPU - the model is small, no GPU needed.
#
# Deploy (uses your Modal credits, roughly $0.0001 per short reply):
#   pip install modal
#   modal setup
#   modal deploy services/modal-tts/modal_app.py
# Modal prints a URL like https://<workspace>--charie-tts-speak.modal.run
# Put it in the portal env as CHARIE_TTS_URL. Optional: enable Modal proxy
# token auth on the endpoint and set CHARIE_TTS_MODAL_KEY / _SECRET too.
#
# Without CHARIE_TTS_URL the portal falls back to the browser voice, so
# nothing breaks before this is deployed.

import io

import modal

app = modal.App("charie-tts")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libsndfile1")
    .pip_install("fastapi[standard]", "kokoro>=0.9.2", "soundfile>=0.12", "numpy")
)

VOICE = "am_michael"  # warm conversational American male


_pipeline = None


def get_pipeline():
    # Load Kokoro once per container and reuse it. Building KPipeline per
    # request reloaded the model every call and cost most of the 20-30s
    # users heard before Charie answered.
    global _pipeline
    if _pipeline is None:
        from kokoro import KPipeline

        _pipeline = KPipeline(lang_code="a")
    return _pipeline


# min_containers=1: one container is always warm, so Charie's first line
# in a call never pays a cold start (20s+). It costs a small idle amount
# on Modal credits; remove it if you would rather pay cold starts.
@app.function(image=image, scaledown_window=1200, timeout=120, min_containers=1)
@modal.fastapi_endpoint(method="POST")
def speak(item: dict):
    from fastapi import Response
    import soundfile as sf

    text = str(item.get("text") or "").strip()[:300]
    if not text:
        return Response(content=b"", status_code=400)
    pipeline = get_pipeline()
    chunks = [audio for _g, _p, audio in pipeline(text, voice=VOICE, speed=1.0)]
    if not chunks:
        return Response(content=b"", status_code=502)
    import numpy as np

    buf = io.BytesIO()
    sf.write(buf, np.concatenate(chunks), 24000, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")
