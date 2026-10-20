# Art inbox

Generated illustrations for Nisseoppdrag come in here before they are cropped, compressed and placed in the app.

## How it works

1. Each round of images has a GitHub issue labelled `art`. The issue holds the preamble and every prompt, and has one checkbox per image.
2. Generate the images (for now in ChatGPT) and save each one as a PNG with the file name given in the prompt, for example `T-10-footprints.png`.
3. Upload them to the round's folder, for example `art/round3/`. In the GitHub web UI, open the folder, choose **Add file → Upload files**, drag all the files in at once, and commit straight to the default branch. Tick the boxes in the issue.
4. Claude picks the files up from there, then reviews, crops and converts them (AVIF and WebP at 1× and 2×) and puts them in the design system.

## Rules

- Only images generated for this project go here. Never upload the inspiration images or anything else under someone else's copyright.
- No text, logos or real people's faces in the images.
- OpenAI's terms allow commercial use of generated images, so they can live in this public repo.

The prompts for each round are in `art/prompts/`.
