# Demo Site checkout investigation (sample demo report)

SAMPLE DEMO DATA - seeded for hackathon judging so every report page opens with coherent content. It is not a live run. Start a real investigation from the ticket and Charie will drive the app with Playwright and, when configured, real Meta models.

## Objective
Check whether the cart total is calculated correctly, whether invalid payment details are rejected, and whether successful checkout updates the order history.

## Result
2 findings: 1 blocker (checkout total mismatch), 1 major (valid card rejected). Both marked verified in the sample after the fix journey passed.

## Model information
Historical sample: deterministic sample analysis (analysisSource: heuristic). Live demo runs label the actual model that answered (Baseten Muse Spark Open or Meta Muse Spark 1.3).
