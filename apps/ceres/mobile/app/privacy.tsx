import { useContext } from "react";
import { View, Text, ScrollView } from "react-native";
import { ThemeContext } from "@/components/theme-context";
import { BRANDING } from "@/utils/config";

export default function PrivacyScreen() {
  const { c } = useContext(ThemeContext);

  const Section = ({ title, children }: { title: string; children: string }) => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 17, fontWeight: "700", color: c.text, marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: c.textSecondary }}>
        {children}
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color: c.text, marginBottom: 8 }}>
        Privacy Policy
      </Text>
      <Text style={{ fontSize: 14, color: c.textMuted, marginBottom: 24 }}>
        Last updated: March 26, 2026
      </Text>

      <Section title="Overview">
        {`${BRANDING.appName} is a free clinical calculator tool provided by ${BRANDING.parentCompany}. This app is designed to help home health professionals calculate Medicare 60-day episode visit frequencies per CMS guidelines (42 CFR §424.22).`}
      </Section>

      <Section title="Data Collection">
        {`${BRANDING.appName} does NOT collect, store, or transmit any personal data, patient information, or Protected Health Information (PHI). All calculations are performed locally on your device.`}
      </Section>

      <Section title="EMR Scan Feature">
        {`When you use the optional EMR Schedule Scanner feature, a photograph of your schedule is sent to our secure server for AI-powered text extraction. The image is processed in real-time and immediately discarded — it is never stored, logged, or retained. No patient-identifiable information should be included in scanned images.`}
      </Section>

      <Section title="No User Accounts">
        {`${BRANDING.appName} does not require user registration, login, or any form of account creation. There are no analytics trackers, advertising SDKs, or third-party data collection tools embedded in this app.`}
      </Section>

      <Section title="Local Storage">
        {`The app stores only your theme preference (light/dark mode) locally on your device using standard device storage. This data never leaves your device.`}
      </Section>

      <Section title="HIPAA Compliance Notice">
        {`${BRANDING.appName} is a clinical reference calculator — it does not process, store, or transmit PHI. It is the user's responsibility to ensure that any EMR images scanned do not contain patient-identifiable information. ${BRANDING.parentCompany} is not a covered entity under HIPAA for the purposes of this free calculator tool.`}
      </Section>

      <Section title="Children's Privacy">
        {`This app is designed for healthcare professionals and is not directed at children under 13. We do not knowingly collect information from children.`}
      </Section>

      <Section title="Changes to This Policy">
        {`We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above and in app updates distributed through the App Store.`}
      </Section>

      <Section title="Contact">
        {`If you have questions about this privacy policy, contact us at:\n\n${BRANDING.parentCompany}\nEmail: privacy@cavaridge.com`}
      </Section>

      <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border, alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: c.textMuted }}>
          © {new Date().getFullYear()} {BRANDING.parentCompany}. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}
