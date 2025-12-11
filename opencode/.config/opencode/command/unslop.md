---
description: Remove AI generated slop (unslop)
---

!`git status`

Check the diffs, and remove all AI generated slop (unwanted/unecessary code) introduced in this branch

This includes:

- Extra comments that a human wouldn't add or is inconsistent with the rest of the file
- Extra defensive checks or try/catch blocks that are abnormal for that area of the codebase (especially if called by trusted / validated codepaths)
- Any other style that is inconsistent with the file
