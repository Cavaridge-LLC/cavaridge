/**
 * CVG-AEGIS — External Posture Scanner
 *
 * Phase 1: Built-in DNS, TLS, and basic port checks.
 * Used for freemium scan landing page and tenant posture assessments.
 */
import { resolve as dnsResolve } from 'dns/promises';
import { connect as tlsConnect, type TLSSocket } from 'tls';
import { connect as netConnect, type Socket } from 'net';

export interface ScanFinding {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface ScanSummary {
  target: string;
  score: number;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  checks: {
    dns: boolean;
    tls: boolean;
    ports: boolean;
  };
}

const COMMON_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 993, 995, 3306, 3389, 5432, 8080, 8443];
const RISKY_PORTS = [21, 23, 25, 110, 143, 445, 3306, 3389, 5432];

/**
 * Run a full external posture scan on a target domain.
 */
export async function runExternalScan(target: string): Promise<{ findings: ScanFinding[]; summary: ScanSummary }> {
  const findings: ScanFinding[] = [];

  // ─── DNS checks ────────────────────────────────────────────────────
  const dnsOk = await checkDns(target, findings);

  // ─── TLS checks ────────────────────────────────────────────────────
  const tlsOk = await checkTls(target, findings);

  // ─── Port scan (common ports only) ─────────────────────────────────
  const portsOk = await checkPorts(target, findings);

  // ─── Score calculation ─────────────────────────────────────────────
  const critical = findings.filter(f => f.severity === 'critical').length;
  const high = findings.filter(f => f.severity === 'high').length;
  const medium = findings.filter(f => f.severity === 'medium').length;
  const low = findings.filter(f => f.severity === 'low').length;
  const info = findings.filter(f => f.severity === 'info').length;

  let score = 100;
  score -= critical * 20;
  score -= high * 10;
  score -= medium * 5;
  score -= low * 2;
  score = Math.max(0, Math.min(100, score));

  return {
    findings,
    summary: {
      target,
      score,
      totalFindings: findings.length,
      critical,
      high,
      medium,
      low,
      info,
      checks: { dns: dnsOk, tls: tlsOk, ports: portsOk },
    },
  };
}

async function checkDns(target: string, findings: ScanFinding[]): Promise<boolean> {
  try {
    // A records
    const aRecords = await dnsResolve(target, 'A').catch(() => []);
    if (aRecords.length === 0) {
      findings.push({
        type: 'dns_no_a_record',
        severity: 'info',
        title: 'No A records found',
        detail: `Domain ${target} has no A records.`,
      });
    }

    // MX records
    const mxRecords = await dnsResolve(target, 'MX').catch(() => []);
    if (mxRecords.length > 0) {
      findings.push({
        type: 'dns_mx_found',
        severity: 'info',
        title: 'MX records found',
        detail: `Domain has ${mxRecords.length} MX record(s).`,
        metadata: { records: mxRecords },
      });
    }

    // SPF check
    const txtRecords = await dnsResolve(target, 'TXT').catch(() => []);
    const spfRecord = (txtRecords as string[]).find((r: string) =>
      typeof r === 'string' ? r.startsWith('v=spf1') : Array.isArray(r) && r.join('').startsWith('v=spf1')
    );
    if (mxRecords.length > 0 && !spfRecord) {
      findings.push({
        type: 'dns_no_spf',
        severity: 'medium',
        title: 'No SPF record found',
        detail: 'Domain sends email but has no SPF record, making it vulnerable to email spoofing.',
      });
    }

    // DMARC check
    const dmarcRecords = await dnsResolve(`_dmarc.${target}`, 'TXT').catch(() => []);
    if (mxRecords.length > 0 && dmarcRecords.length === 0) {
      findings.push({
        type: 'dns_no_dmarc',
        severity: 'medium',
        title: 'No DMARC record found',
        detail: 'Domain sends email but has no DMARC policy, leaving it vulnerable to phishing.',
      });
    }

    return true;
  } catch {
    return false;
  }
}

async function checkTls(target: string, findings: ScanFinding[]): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      findings.push({
        type: 'tls_timeout',
        severity: 'high',
        title: 'TLS connection timeout',
        detail: `Could not establish TLS connection to ${target}:443 within 10 seconds.`,
      });
      resolve(false);
    }, 10_000);

    try {
      const socket: TLSSocket = tlsConnect(443, target, { servername: target, rejectUnauthorized: false }, () => {
        clearTimeout(timeout);

        const cert = socket.getPeerCertificate();
        if (cert) {
          // Check expiration
          const validTo = new Date(cert.valid_to);
          const now = new Date();
          const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry < 0) {
            findings.push({
              type: 'tls_cert_expired',
              severity: 'critical',
              title: 'SSL/TLS certificate expired',
              detail: `Certificate expired ${Math.abs(daysUntilExpiry)} days ago.`,
              metadata: { validTo: cert.valid_to, issuer: cert.issuer },
            });
          } else if (daysUntilExpiry < 14) {
            findings.push({
              type: 'tls_cert_expiring',
              severity: 'high',
              title: 'SSL/TLS certificate expiring soon',
              detail: `Certificate expires in ${daysUntilExpiry} days.`,
              metadata: { validTo: cert.valid_to },
            });
          } else if (daysUntilExpiry < 30) {
            findings.push({
              type: 'tls_cert_expiring',
              severity: 'medium',
              title: 'SSL/TLS certificate expiring within 30 days',
              detail: `Certificate expires in ${daysUntilExpiry} days.`,
              metadata: { validTo: cert.valid_to },
            });
          }

          // Check if self-signed
          if (cert.issuer && cert.subject &&
              JSON.stringify(cert.issuer) === JSON.stringify(cert.subject)) {
            findings.push({
              type: 'tls_self_signed',
              severity: 'high',
              title: 'Self-signed certificate detected',
              detail: 'The certificate is self-signed and will not be trusted by browsers.',
            });
          }

          findings.push({
            type: 'tls_info',
            severity: 'info',
            title: 'TLS certificate details',
            detail: `Certificate valid until ${cert.valid_to}. Issued by ${cert.issuer?.O ?? 'Unknown'}.`,
            metadata: {
              subject: cert.subject,
              issuer: cert.issuer,
              validFrom: cert.valid_from,
              validTo: cert.valid_to,
              protocol: socket.getProtocol(),
            },
          });
        }

        if (!socket.authorized) {
          findings.push({
            type: 'tls_not_trusted',
            severity: 'high',
            title: 'TLS certificate not trusted',
            detail: socket.authorizationError ?? 'Certificate validation failed.',
          });
        }

        socket.end();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        findings.push({
          type: 'tls_error',
          severity: 'high',
          title: 'TLS connection failed',
          detail: `Cannot establish HTTPS connection to ${target}:443.`,
        });
        resolve(false);
      });
    } catch {
      clearTimeout(timeout);
      resolve(false);
    }
  });
}

async function checkPorts(target: string, findings: ScanFinding[]): Promise<boolean> {
  const openPorts: number[] = [];

  const checks = COMMON_PORTS.map(port => checkPort(target, port));
  const results = await Promise.allSettled(checks);

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      openPorts.push(COMMON_PORTS[i]);
    }
  });

  if (openPorts.length > 0) {
    findings.push({
      type: 'ports_open',
      severity: 'info',
      title: 'Open ports detected',
      detail: `Found ${openPorts.length} open port(s): ${openPorts.join(', ')}`,
      metadata: { ports: openPorts },
    });
  }

  // Flag risky open ports
  const riskyOpen = openPorts.filter(p => RISKY_PORTS.includes(p));
  if (riskyOpen.length > 0) {
    const portNames: Record<number, string> = {
      21: 'FTP', 23: 'Telnet', 25: 'SMTP', 110: 'POP3',
      143: 'IMAP', 445: 'SMB', 3306: 'MySQL', 3389: 'RDP', 5432: 'PostgreSQL',
    };
    for (const port of riskyOpen) {
      const sev = [23, 3389, 445].includes(port) ? 'critical' as const : 'high' as const;
      findings.push({
        type: 'port_risky',
        severity: sev,
        title: `Risky port open: ${port} (${portNames[port] ?? 'Unknown'})`,
        detail: `Port ${port} (${portNames[port] ?? 'Unknown'}) is exposed to the internet. This is a common attack vector.`,
        metadata: { port, service: portNames[port] },
      });
    }
  }

  return true;
}

function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);

    const socket: Socket = netConnect(port, host, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
