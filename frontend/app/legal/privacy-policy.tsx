import React from "react";
import { LegalDoc, LegalSection, SUPPORT_EMAIL } from "@/src/components/LegalDoc";

const SECTIONS: LegalSection[] = [
  {
    title: "Who we are",
    body: [
      `RF Photos is a photo and video gallery app made by RF Alphabet ("we", "us"). You can contact us at ${SUPPORT_EMAIL}.`,
      "This policy explains what RF Photos accesses on your phone, what it stores, and what control you have. It applies to the RF Photos app on Android and iOS.",
    ],
  },
  {
    title: "The short version",
    bullets: [
      "RF Photos has no accounts, no sign-in, no advertising, no analytics and no tracking.",
      "Your photos, videos and everything you add to them (favourites, tags, captions, notes, albums, slideshows) stay on your device. The app does not upload them to us or to anyone else.",
      "We do not receive, sell, rent or share your personal data, because the app does not send it to us.",
      "Data leaves your phone only when you choose to share a file, export a backup to a place you pick, or email us.",
    ],
  },
  {
    title: "Permissions and why we ask",
    body: ["RF Photos asks for each permission only when you use the feature that needs it. You can refuse or revoke any permission in your phone's Settings, and the rest of the app keeps working."],
    bullets: [
      "Photos and videos (Android 13+: READ_MEDIA_IMAGES and READ_MEDIA_VIDEO; Android 14+: “Select photos and videos” for limited access; Android 12 and lower: READ_EXTERNAL_STORAGE; iOS: Photos). Used to show your gallery, including Camera, WhatsApp, Screenshots, Downloads and other folders your phone indexes, and to create albums or delete items when you ask. With limited access RF Photos sees only the items you selected.",
      "Photo location (Android: ACCESS_MEDIA_LOCATION). Used only to read the location already stored inside your photos for the Travel Atlas, and only while “Location indexing” is on in the Privacy Center. RF Photos does not access your phone's current location.",
      "Camera. Used to take photos, record videos and scan documents in RF Photos.",
      "Microphone. Used only to record sound while you record a video.",
      "Face ID / fingerprint (biometrics). Used to unlock the private Vault if you turn it on. Your phone checks your biometrics; RF Photos never receives your fingerprint or face data.",
      "If you don't grant gallery access, you can still choose individual photos and videos through the system photo picker. Android shows that picker, and only the items you pick are copied into RF Photos.",
    ],
  },
  {
    title: "What RF Photos stores on your device",
    bullets: [
      "An app database in RF Photos' private storage: favourites, archive flags, tags, captions, notes, annotations, smart album rules, saved searches, saved slideshows, edit history, import and job history, settings and, if enabled, a location index.",
      "Copies of files you import, capture without gallery access, or move to the Vault, kept in RF Photos' private storage.",
      "Your Vault PIN, kept only as a salted SHA-256 hash in the phone's secure storage (Android Keystore / iOS Keychain).",
      "Short-lived copies in the app cache when you share a gallery file (Android requires this). The system may clear them at any time.",
      "Vault files are hidden from the gallery and search, but RF Photos does not add its own encryption to them. They are protected by your phone's own storage encryption and screen lock.",
    ],
  },
  {
    title: "On-device processing and “smart” features",
    body: [
      "Search, date grouping (Today, Yesterday, dates), events, “On this day”, bursts, duplicate review, storage analysis, the Action Agent, editing, collages and slideshows all run entirely on your device. They work in Airplane Mode.",
      "These features work from file information (capture date, type, size, resolution, duration, file name, folder) and from text you add. RF Photos does not currently include any machine-learning (AI) model. It does not recognise faces, people, pets or objects, does not read text in images (OCR), and does not create biometric templates. If a future version adds on-device AI models, they will run on your device and we will update this policy first.",
    ],
  },
  {
    title: "Automatic albums and collections",
    bullets: [
      "Device albums are the folders your phone already has (for example Camera, WhatsApp Images, Screenshots, Download). RF Photos reads them; it doesn't move your files.",
      "Smart collections (Favourites, Videos, Screenshots, Large videos, Duplicate review, Archive, Recently imported) and smart albums you create are calculated on your device from file information and your own rules. Nothing is deleted automatically.",
      "When you create a new album, Android copies the selected items into a new folder on your device.",
    ],
  },
  {
    title: "Monthly memories and slideshows",
    body: ["RF Photos groups your media by calendar month, event and “on this day” using capture dates. Memory slideshows are played inside the app with transitions. They are made on your device, are not uploaded, and are not exported as video files. A saved slideshow stores only its title, settings and a list of the items it uses."],
  },
  {
    title: "Sharing, exports and backups",
    bullets: [
      "Sharing happens only when you tap Share. The file goes to your phone's share sheet and then to the app you choose; that app's own privacy policy applies from then on.",
      "Privacy Export can remove location and other metadata from copies before you share them.",
      "Backups and media exports are written only to a folder or location you choose. They are your files; RF Photos does not upload them.",
    ],
  },
  {
    title: "Deleting your data",
    bullets: [
      "Deleting a gallery photo or video removes it from your device. Android usually asks you to confirm. RF Photos can't undo this.",
      "Deleting an imported item removes RF Photos' copy only.",
      "Privacy Center lets you delete the location index and your action, import and job history at any time.",
      "Clearing RF Photos' storage in Android Settings, or uninstalling the app, permanently erases the app database, imported copies and Vault contents. Move anything you want to keep out of the Vault first. Your gallery files are not affected.",
    ],
  },
  {
    title: "Information we receive",
    body: [
      "Only what you send us yourself, for example an email to support. We use your email address and message only to reply and to help you, and we keep them only as long as needed for that or as the law requires.",
      "App stores (such as Google Play or the App Store) and your phone's operating system may collect data such as downloads or crash reports under their own policies. We don't control that collection.",
    ],
  },
  {
    title: "Children",
    body: ["RF Photos is a general-purpose app and is not directed at children under 13, or under the minimum age set by the law where they live. We do not knowingly collect children's personal data. Because the app sends no personal data to us, we hold none about children who use it."],
  },
  {
    title: "Security",
    body: ["Your data's safety depends mainly on your device. Use a screen lock, keep your phone updated, and protect any backup files you export. RF Photos uses the phone's private app storage and secure storage, and adds no network connection that could expose your media."],
  },
  {
    title: "Your rights, wherever you live",
    body: [
      "Depending on where you live, privacy laws may give you rights over your personal data. These include the EU and UK GDPR, the California CCPA/CPRA and other US state laws, India's Digital Personal Data Protection Act 2023, Brazil's LGPD, Canada's PIPEDA, Australia's Privacy Act, and similar laws worldwide. They can include rights to access, correct, delete, restrict or object to processing, to data portability, to withdraw consent, and to not be discriminated against for using these rights.",
      "Your RF Photos data is on your device, not with us, so you can use most of these rights directly: view and edit everything in the app, export it with Backup & Recovery, and delete it in the app or by uninstalling. Permissions can be withdrawn at any time in Settings.",
      `For any request about data you sent us (such as support emails), write to ${SUPPORT_EMAIL}. We reply within 30 days, or sooner if your law requires. You also have the right to complain to your local data protection authority.`,
      "We do not sell or “share” personal information for cross-context behavioural advertising, and we do not use your data for profiling or automated decisions.",
    ],
  },
  {
    title: "International transfers",
    body: ["The app does not transfer your photos, videos or app data to us or abroad. If you email us, the message is handled by our email provider and may be processed in other countries. Where the law requires, appropriate safeguards apply."],
  },
  {
    title: "Changes to this policy",
    body: ["If RF Photos changes how it handles data, we will update this policy and its effective date in the app before the change applies. Where the law requires, we will ask for your consent."],
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalDoc
      testID="privacy-policy-screen"
      title="Privacy Policy"
      intro="Your memories are personal. RF Photos is built to work on your phone, without accounts or cloud uploads. This policy explains exactly what that means."
      sections={SECTIONS}
      other={{ label: "Terms & Conditions", route: "/legal/terms" }}
    />
  );
}
