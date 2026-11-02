# Charie voice on Modal

Natural male voice for Charie in Meet calls, on your Modal credits.

## Deploy

```bash
pip install modal
modal setup
modal deploy services/modal-tts/modal_app.py
```

Modal prints an endpoint URL. Set it on the portal:

- `CHARIE_TTS_URL` - the printed `speak` URL.
- Optional proxy-token auth: `CHARIE_TTS_MODAL_KEY` and `CHARIE_TTS_MODAL_SECRET`.

Model: Kokoro-82M, voice `am_michael` (warm conversational American male),
CPU only, scales to zero. First call after idle takes a few seconds while
the container warms; Charie falls back to the browser voice until audio
arrives, so a cold start never silences her.

Change the voice by editing `VOICE` in [modal_app.py](modal_app.py):
`am_adam` (brighter male), `bm_george` (British male), `am_michael` (default).
