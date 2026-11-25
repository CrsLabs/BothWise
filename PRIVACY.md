# BothWise privacy policy

*Last updated: 23 November 2026* · Full policy online: [crslabs.github.io/privacy/bothwise.html](https://crslabs.github.io/privacy/bothwise.html) (English and Italian)

BothWise is built to **collect no data**: no accounts of its own, no ads, no analytics or tracking, and CrsLabs has no servers that receive your files.

## What data it handles and where it stays
- **Your files** stay in the folders you choose, on your devices. BothWise copies them only to devices you paired yourself, with a code or a QR.
- On the same Wi‑Fi, files go **directly** from one device to another over an encrypted connection (TLS 1.3), with no server in between.
- Settings, names of paired devices and keys stay in the app's private storage; keys are protected by the Android Keystore.

## Away from Wi‑Fi: Google Drive or Dropbox (optional)
- Only if you turn it on (Settings → «Away from Wi‑Fi»), BothWise uses **your** Google Drive or **your** Dropbox as an **encrypted mailbox**.
- It writes only data **encrypted on your devices** before it leaves (AES‑256‑GCM), with names that reveal nothing, in its own folder. The key never leaves your devices: Google, Dropbox and CrsLabs cannot read the content or the names of your files.
- On Google Drive BothWise requests only the `drive.file` scope, i.e. access **only to files the app created**; on Dropbox access is limited to the app folder.
- Access tokens are stored encrypted on the device and never sent anywhere else. «Disconnect» revokes them.
- BothWise's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.

## When the app uses the internet
- **Google Drive or Dropbox**, only if you connected them.
- **Update check** (can be turned off in Settings → Updates): once a week the app reads the latest published version from GitHub. None of your data is sent; GitHub, like any website, sees the device's internet address.
- **Report a problem or an idea**: an email you send yourself to crslabs.info@gmail.com; the technical information never includes your files or folder names and can be removed.
- **Support BothWise**: opens Ko-fi in the browser only when tapped.

## Android permissions
Network and Wi‑Fi (paired devices), location only to read the Wi‑Fi name if you choose trusted networks (BothWise doesn't read or store your location), camera (pairing QR), notifications and foreground service (staying reachable during the hours you choose), fingerprint/PIN (optional lock), install apps (updates, always confirmed by Android). Folder access is only what you grant, folder by folder. In addition, "All files access" (MANAGE_EXTERNAL_STORAGE) is requested once, only to create and use the automatic **BothWise** folder in the phone's storage: the app reads and writes only inside that folder, never elsewhere, and you can refuse it and keep choosing folders with the Android picker.

## Deleting your data
Settings → Security and data → «Erase everything from this device» removes pairings, keys, settings and Drive or Dropbox connections; your folders and files stay where they are. Or uninstall the app.

## Contact
CrsLabs · crslabs.info@gmail.com
