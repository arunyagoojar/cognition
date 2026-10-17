# Production content maintenance

These Python tools do not run in the deployed app. They remain because they generate or independently validate the production question bank:

- `build_runtime.py`: creates `src/data/production/productionContent.js` from reviewed records.
- `build_speaking_phase4.py`: assembles speaking packages from the authored content.
- `extract_*.py`: reconstruct source records; the listening extractor also supplies shared helpers to the production, speaking, and writing extractors.
- `validate_reading.py`: validates the committed reading records without the external source mirror.
- `validate_writing.py`: independently compares writing records with the source mirror (`COGNITION_SRC_ROOT`), requiring BeautifulSoup4 and Pillow.

The historical pilot renderer and phase-report generator were removed. Do not run extractors merely to start the application; some regenerate content in place and require the original source mirror. `docs/phase1` holds provenance and manifests used by those generators.
