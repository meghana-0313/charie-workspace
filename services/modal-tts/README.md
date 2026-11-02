# Charie voice on Modal

Natural male voice for Charie in Meet calls, on your Modal credits.

## Deploy

```bash
pip install modal
modal setup
modal deploy services/modal-tts/modal_app.py
```

Modal prints an endpoint URL. In GCP Secret Manager (project project-8b9ab843-d0d6-4ea4-a11) create one secret, CHARIE_TTS_URL, with that URL as its value. The portal deploy mounts it as the CHARIE_TTS_URL env var, so no login is needed anywhere else. Create the secret before merging the deploy change: Cloud Run fails a deploy that references a missing secret.

- `CHARIE_TTS_URL` - the printed `speak` URL.
- Optional proxy-token auth: `CHARIE_TTS_MODAL_KEY` and `CHARIE_TTS_MODAL_SECRET`.

Model: Kokoro-82M, voice `am_michael` (warm conversational American male),
CPU only, scales to zero. First call after idle takes a few seconds while
the container warms; Charie falls back to the browser voice until audio
arrives, so a cold start never silences her.

Change the voice by editing `VOICE` in [modal_app.py](modal_app.py):
`am_adam` (brighter male), `bm_george` (British male), `am_michael` (default).
