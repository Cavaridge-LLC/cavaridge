/**
 * Privacy Policy Screen (Modal)
 *
 * Presented as a modal from Settings. Covers data handling,
 * Supabase auth, knowledge base, and LLM routing policies.
 */

import { useContext } from "react";
import { View, Text, ScrollView } from "react-native";
import { ThemeContext } from "@/components/theme-context";
import { BRANDING } from "@/utils/api";

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
        Last updated: March 27, 2026
      </Text>

      <Section title="Overview">
        {`${BRANDING.appName} is an AI-powered research and intelligence platform provided by ${BRANDING.parentCompany}. This app enables professionals to ask questions, search knowledge bases, and receive sourced, AI-generated answers.`}
      </Section>

      <Section title="Authentication">
        {`${BRANDING.appName} uses Supabase for secure authentication. Your email and hashed password are stored in our Supabase-hosted database. Authentication tokens are stored securely on your device using encrypted storage. We never store plaintext passwords.`}
      </Section>

      <Section title="Data We Collect">
        {`When you use ${BRANDING.appName}, we store:\n\n- Your email address (for authentication)\n- Questions you ask and the AI-generated responses\n- Conversation history (scoped to your tenant)\n- Saved answers you bookmark\n- Usage metrics (question count, token usage)\n\nAll data is tenant-scoped using row-level security. Your data is never accessible to other tenants.`}
      </Section>

      <Section title="AI Processing">
        {`Your questions are processed through Cavaridge's Spaniel LLM gateway, which routes requests to AI models via OpenRouter. Questions may be enriched with relevant knowledge base content (RAG) before processing. We do not use your questions to train AI models. Conversations with sensitive content can be deleted at any time.`}
      </Section>

      <Section title="Knowledge Base">
        {`Knowledge sources you upload (documents, URLs, text) are chunked, embedded, and stored in your tenant-scoped database. This data is used solely to improve the relevance of answers to your questions. Knowledge data is never shared across tenants.`}
      </Section>

      <Section title="Data Retention">
        {`Conversation history and saved answers are retained until you delete them. You can archive or delete conversations at any time. Account deletion requests can be submitted to privacy@cavaridge.com and will be processed within 30 days.`}
      </Section>

      <Section title="Third-Party Services">
        {`${BRANDING.appName} uses the following third-party services:\n\n- Supabase (authentication and database hosting)\n- OpenRouter (AI model routing via Spaniel gateway)\n- Railway (application hosting)\n\nEach service has its own privacy policy. We ensure all data transmission uses TLS encryption.`}
      </Section>

      <Section title="Children's Privacy">
        {`${BRANDING.appName} is designed for professional use and is not directed at children under 13. We do not knowingly collect information from children.`}
      </Section>

      <Section title="Changes to This Policy">
        {`We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above and in app updates.`}
      </Section>

      <Section title="Contact">
        {`If you have questions about this privacy policy, contact us at:\n\n${BRANDING.parentCompany}\nEmail: privacy@cavaridge.com`}
      </Section>

      <View
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: c.border,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 12, color: c.textMuted }}>
          {new Date().getFullYear()} {BRANDING.parentCompany}. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}
