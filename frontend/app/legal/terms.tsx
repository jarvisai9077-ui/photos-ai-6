import React from "react";
import { LegalDoc, LegalSection, SUPPORT_EMAIL } from "@/src/components/LegalDoc";

const SECTIONS: LegalSection[] = [
  {
    title: "Agreement",
    body: [
      `These Terms & Conditions ("Terms") are an agreement between you and RF Alphabet ("we", "us") for your use of the RF Photos app. By installing or using RF Photos you accept these Terms and our Privacy Policy. If you do not agree, please do not use the app.`,
    ],
  },
  {
    title: "Who can use RF Photos",
    body: ["You must be old enough to agree to these Terms where you live, or have permission from a parent or guardian. You are responsible for how RF Photos is used on your device."],
  },
  {
    title: "Your licence to use the app",
    body: ["We give you a personal, non-exclusive, non-transferable, revocable licence to install and use RF Photos on devices you own or control, for personal use, under these Terms and the rules of the app store you downloaded it from."],
  },
  {
    title: "Your photos, videos and content",
    bullets: [
      "You keep all rights to your photos, videos and anything you add to them. RF Photos processes your content on your device, and we do not receive it or claim any rights to it.",
      "You are responsible for having the right to store, edit and share the content you use in RF Photos, and for respecting other people's privacy and rights when you capture or share it.",
      "You are responsible for keeping your own backups. Phones can be lost, reset or damaged, and data in RF Photos' private storage (including the Vault) is erased if the app is uninstalled or its storage is cleared.",
    ],
  },
  {
    title: "Permissions and device features",
    body: ["Some features need permissions such as photos and videos, camera, microphone, photo location or biometrics. You decide whether to grant them and can change your choice in your phone's Settings at any time. Features that need a permission you refused will not be available, and the app tells you when that happens."],
  },
  {
    title: "What the features do, and their limits",
    bullets: [
      "RF Photos works offline and on your device. Search, memories, collections and duplicate review use file information and your own tags and notes. The app does not include AI models for faces, objects or text recognition.",
      "Memory slideshows play inside the app. They are not exported or saved as video files.",
      "Video playback uses your phone's built-in decoders. Some formats or codecs may not play on some devices; RF Photos then offers to open the file in another app.",
      "With limited access (“Select photos and videos”), or in preview builds that can't get full gallery access, RF Photos shows only the items you allowed or imported.",
      "The Vault hides items inside RF Photos and protects access with a PIN and optional biometrics. RF Photos does not add its own encryption to Vault files beyond your phone's storage encryption.",
      "Deleting gallery items removes them from your device and can't be undone by RF Photos. Android may ask you to confirm.",
      "Duplicate review, storage estimates and similar tools are suggestions based on metadata. Check before you delete anything.",
      "Features and their availability can vary by device, Android or iOS version, and manufacturer.",
    ],
  },
  {
    title: "Acceptable use",
    body: ["You agree not to use RF Photos to break any law, to infringe other people's intellectual property or privacy, to store or share content that exploits or harms children, or to reverse engineer, resell or redistribute the app except as the law expressly allows."],
  },
  {
    title: "Third-party services",
    body: ["RF Photos uses parts of your operating system, such as the system photo picker, the share sheet, file providers and biometric unlock. When you share content to another app or service, that app's terms and privacy policy apply. We are not responsible for third-party apps or services."],
  },
  {
    title: "Our intellectual property",
    body: ["The RF Photos name, logo, design and software belong to RF Alphabet and its licensors. These Terms do not give you any rights to them except the licence above. Open-source components are used under their own licences."],
  },
  {
    title: "Updates and changes",
    body: ["We may update RF Photos to add, improve or remove features, fix problems or meet legal requirements. We may also update these Terms. The effective date at the top shows the current version, and important changes are shown in the app. If you keep using RF Photos after a change, you accept the updated Terms."],
  },
  {
    title: "Disclaimer",
    body: ["RF Photos is provided “as is” and “as available”. To the extent the law allows, we make no warranties beyond those stated in these Terms. In particular, we do not promise that the app will be error-free or uninterrupted, or that it will work with every file format or device."],
  },
  {
    title: "Limitation of liability",
    body: [
      "To the extent the law allows, RF Alphabet is not liable for indirect, incidental, special or consequential losses, or for loss of data, photos, videos or profits, arising from your use of RF Photos. This includes deletions you confirm, loss of your device, or uninstalling the app. RF Photos is free to use, so where liability can be limited, our total liability is limited to the amount you paid for the app, if any.",
      "Nothing in these Terms excludes or limits liability that cannot be excluded by law. This includes liability for death or personal injury caused by negligence, for fraud, or your statutory rights as a consumer.",
    ],
  },
  {
    title: "Ending these Terms",
    body: ["You can stop using RF Photos at any time by uninstalling it. If you seriously breach these Terms, your licence ends. The sections on your content, intellectual property, disclaimer, limitation of liability and applicable law continue to apply."],
  },
  {
    title: "Applicable law and consumer rights worldwide",
    body: [
      "RF Photos is available worldwide, so we do not pick one country's law for everyone. These Terms are governed by the laws of the country where you live. Any dispute can be brought before the courts that your local law allows.",
      "Wherever you are, you keep the mandatory protections of your local consumer and data protection laws, and these Terms never take them away. If any part of these Terms is invalid where you live, the rest still applies.",
      `Before starting formal proceedings, please contact us at ${SUPPORT_EMAIL} so we can try to resolve the issue informally.`,
    ],
  },
];

export default function Terms() {
  return (
    <LegalDoc
      testID="terms-screen"
      title="Terms & Conditions"
      intro="These Terms explain the rules for using RF Photos, what the app does and doesn't do, and your rights."
      sections={SECTIONS}
      other={{ label: "Privacy Policy", route: "/legal/privacy-policy" }}
    />
  );
}
