# Lessons

- When the user asks for a UI change that references another app, match the requested scope first instead of expanding it into a broader chrome redesign.
- For Electron app branding bugs, verify which surface shows the wrong name before changing code: `app.setName()` only affects Electron's internal app name, while macOS Dock/app-switcher labels in dev still come from the `electron .` runtime bundle.
- When changing the Electron dev launch path, verify the runtime asset root still resolves correctly for `bin/` and bundled resources before considering the launcher fix complete.
