# Lessons

- When the user asks for a UI change that references another app, match the requested scope first instead of expanding it into a broader chrome redesign.
- For Electron app branding bugs, verify which surface shows the wrong name before changing code: `app.setName()` only affects Electron's internal app name, while macOS Dock/app-switcher labels in dev still come from the `electron .` runtime bundle.
- When changing the Electron dev launch path, verify the runtime asset root still resolves correctly for `bin/` and bundled resources before considering the launcher fix complete.
- For landing-page updates, avoid turning secondary product details into large boxed sublayouts inside the hero. Keep the hero focused on one primary message and use concise supporting availability signals instead of dense install UI.
- When preparing release or CI changes, do not add optional future-proofing paths the team does not plan to use. Keep distribution logic limited to the current shipping model and remove dormant signing/notarization code unless explicitly requested.
