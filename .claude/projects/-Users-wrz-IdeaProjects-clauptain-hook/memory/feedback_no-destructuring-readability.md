---
name: no-destructuring-readability
description: Prefer plain const assignments over destructuring when it hurts readability
metadata:
  type: feedback
---

When extracting repeated property accesses into variables, use plain `const x = obj.x` assignments instead of destructuring (`const { x } = obj`) when destructuring would hurt readability — e.g. when there are many fields, reserved-word collisions (`if`, `async`), or it results in a long single line.

**Why:** User finds destructuring harder to read in these cases.
**How to apply:** Default to `const name = handler.name` style. Only destructure when there are few, simple fields. See [[const-over-let]].