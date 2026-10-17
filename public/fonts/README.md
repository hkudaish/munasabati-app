# Saudi riyal symbol

`saudi-riyal.svg` is the official Saudi Central Bank outline, downloaded from:
https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg

Usage guidance: https://www.sama.gov.sa/en-US/Currency/SRS/Pages/Guideline.aspx

`saudi-riyal.ttf` contains only U+20C1 and embeds that outline without changing
its proportions. The CSS unicode range leaves Arabic text and Latin digits in
the application's existing fonts. This avoids missing glyphs on older devices.

Regenerate from the repository root with `python3 scripts/build-riyal-font.py`
(requires FontTools). The application build does not require Python.
