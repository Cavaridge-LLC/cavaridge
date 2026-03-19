/**
 * HIPAA Security Rule Control Library
 *
 * Complete mapping of 45 CFR 164.308-312 safeguards.
 * 18 standards, ~41 implementation specifications across 3 categories.
 * Each control marked as Required (R) or Addressable (A).
 */

export interface HipaaControlSpec {
  ref: string;
  name: string;
  required: boolean;
  description: string;
}

export interface HipaaControl {
  ref: string;
  standard: string;
  category: "administrative" | "physical" | "technical";
  required: boolean;
  description: string;
  specifications: HipaaControlSpec[];
}

export const HIPAA_SECURITY_CONTROLS: HipaaControl[] = [
  // ── Administrative Safeguards (§164.308) ──

  {
    ref: "164.308(a)(1)",
    standard: "Security Management Process",
    category: "administrative",
    required: true,
    description: "Implement policies and procedures to prevent, detect, contain, and correct security violations.",
    specifications: [
      {
        ref: "164.308(a)(1)(ii)(A)",
        name: "Risk Analysis",
        required: true,
        description: "Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of electronic protected health information held by the covered entity or business associate.",
      },
      {
        ref: "164.308(a)(1)(ii)(B)",
        name: "Risk Management",
        required: true,
        description: "Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level.",
      },
      {
        ref: "164.308(a)(1)(ii)(C)",
        name: "Sanction Policy",
        required: true,
        description: "Apply appropriate sanctions against workforce members who fail to comply with the security policies and procedures of the covered entity or business associate.",
      },
      {
        ref: "164.308(a)(1)(ii)(D)",
        name: "Information System Activity Review",
        required: true,
        description: "Implement procedures to regularly review records of information system activity, such as audit logs, access reports, and security incident tracking reports.",
      },
    ],
  },
  {
    ref: "164.308(a)(2)",
    standard: "Assigned Security Responsibility",
    category: "administrative",
    required: true,
    description: "Identify the security official who is responsible for the development and implementation of the policies and procedures required for the entity.",
    specifications: [],
  },
  {
    ref: "164.308(a)(3)",
    standard: "Workforce Security",
    category: "administrative",
    required: true,
    description: "Implement policies and procedures to ensure that all members of its workforce have appropriate access to electronic protected health information and to prevent those workforce members who do not have access from obtaining access to electronic protected health information.",
    specifications: [
      {
        ref: "164.308(a)(3)(ii)(A)",
        name: "Authorization and/or Supervision",
        required: false,
        description: "Implement procedures for the authorization and/or supervision of workforce members who work with electronic protected health information or in locations where it might be accessed.",
      },
      {
        ref: "164.308(a)(3)(ii)(B)",
        name: "Workforce Clearance Procedure",
        required: false,
        description: "Implement procedures to determine that the access of a workforce member to electronic protected health information is appropriate.",
      },
      {
        ref: "164.308(a)(3)(ii)(C)",
        name: "Termination Procedures",
        required: false,
        description: "Implement procedures for terminating access to electronic protected health information when the employment of, or other arrangement with, a workforce member ends.",
      },
    ],
  },
  {
    ref: "164.308(a)(4)",
    standard: "Information Access Management",
    category: "administrative",
    required: true,
    description: "Implement policies and procedures for authorizing access to electronic protected health information.",
    specifications: [
      {
        ref: "164.308(a)(4)(ii)(A)",
        name: "Isolating Healthcare Clearinghouse Functions",
        required: true,
        description: "If a healthcare clearinghouse is part of a larger organization, the clearinghouse must implement policies and procedures that protect the electronic protected health information of the clearinghouse from unauthorized access by the larger organization.",
      },
      {
        ref: "164.308(a)(4)(ii)(B)",
        name: "Access Authorization",
        required: false,
        description: "Implement policies and procedures for granting access to electronic protected health information, for example, through access to a workstation, transaction, program, process, or other mechanism.",
      },
      {
        ref: "164.308(a)(4)(ii)(C)",
        name: "Access Establishment and Modification",
        required: false,
        description: "Implement policies and procedures that, based upon the covered entity's or the business associate's access authorization policies, establish, document, review, and modify a user's right of access to a workstation, transaction, program, or process.",
      },
    ],
  },
  {
    ref: "164.308(a)(5)",
    standard: "Security Awareness and Training",
    category: "administrative",
    required: true,
    description: "Implement a security awareness and training program for all members of its workforce (including management).",
    specifications: [
      {
        ref: "164.308(a)(5)(ii)(A)",
        name: "Security Reminders",
        required: false,
        description: "Periodic security updates.",
      },
      {
        ref: "164.308(a)(5)(ii)(B)",
        name: "Protection from Malicious Software",
        required: false,
        description: "Procedures for guarding against, detecting, and reporting malicious software.",
      },
      {
        ref: "164.308(a)(5)(ii)(C)",
        name: "Log-in Monitoring",
        required: false,
        description: "Procedures for monitoring log-in attempts and reporting discrepancies.",
      },
      {
        ref: "164.308(a)(5)(ii)(D)",
        name: "Password Management",
        required: false,
        description: "Procedures for creating, changing, and safeguarding passwords.",
      },
    ],
  },
  {
    ref: "164.308(a)(6)",
    standard: "Security Incident Procedures",
    category: "administrative",
    required: true,
    description: "Implement policies and procedures to address security incidents.",
    specifications: [
      {
        ref: "164.308(a)(6)(ii)",
        name: "Response and Reporting",
        required: true,
        description: "Identify and respond to suspected or known security incidents; mitigate, to the extent practicable, harmful effects of security incidents that are known to the covered entity or business associate; and document security incidents and their outcomes.",
      },
    ],
  },
  {
    ref: "164.308(a)(7)",
    standard: "Contingency Plan",
    category: "administrative",
    required: true,
    description: "Establish (and implement as needed) policies and procedures for responding to an emergency or other occurrence that damages systems that contain electronic protected health information.",
    specifications: [
      {
        ref: "164.308(a)(7)(ii)(A)",
        name: "Data Backup Plan",
        required: true,
        description: "Establish and implement procedures to create and maintain retrievable exact copies of electronic protected health information.",
      },
      {
        ref: "164.308(a)(7)(ii)(B)",
        name: "Disaster Recovery Plan",
        required: true,
        description: "Establish (and implement as needed) procedures to restore any loss of data.",
      },
      {
        ref: "164.308(a)(7)(ii)(C)",
        name: "Emergency Mode Operation Plan",
        required: true,
        description: "Establish (and implement as needed) procedures to enable continuation of critical business processes for protection of the security of electronic protected health information while operating in emergency mode.",
      },
      {
        ref: "164.308(a)(7)(ii)(D)",
        name: "Testing and Revision Procedures",
        required: false,
        description: "Implement procedures for periodic testing and revision of contingency plans.",
      },
      {
        ref: "164.308(a)(7)(ii)(E)",
        name: "Applications and Data Criticality Analysis",
        required: false,
        description: "Assess the relative criticality of specific applications and data in support of other contingency plan components.",
      },
    ],
  },
  {
    ref: "164.308(a)(8)",
    standard: "Evaluation",
    category: "administrative",
    required: true,
    description: "Perform a periodic technical and nontechnical evaluation, based initially upon the standards implemented under this rule and, subsequently, in response to environmental or operational changes affecting the security of electronic protected health information.",
    specifications: [],
  },
  {
    ref: "164.308(b)(1)",
    standard: "Business Associate Contracts and Other Arrangements",
    category: "administrative",
    required: true,
    description: "A covered entity may permit a business associate to create, receive, maintain, or transmit electronic protected health information on the covered entity's behalf only if the covered entity obtains satisfactory assurances that the business associate will appropriately safeguard the information.",
    specifications: [
      {
        ref: "164.308(b)(4)",
        name: "Written Contract or Other Arrangement",
        required: true,
        description: "Document the satisfactory assurances required through a written contract or other arrangement with the business associate.",
      },
    ],
  },

  // ── Physical Safeguards (§164.310) ──

  {
    ref: "164.310(a)(1)",
    standard: "Facility Access Controls",
    category: "physical",
    required: true,
    description: "Implement policies and procedures to limit physical access to its electronic information systems and the facility or facilities in which they are housed, while ensuring that properly authorized access is allowed.",
    specifications: [
      {
        ref: "164.310(a)(2)(i)",
        name: "Contingency Operations",
        required: false,
        description: "Establish (and implement as needed) procedures that allow facility access in support of restoration of lost data under the disaster recovery plan and emergency mode operations plan in the event of an emergency.",
      },
      {
        ref: "164.310(a)(2)(ii)",
        name: "Facility Security Plan",
        required: false,
        description: "Implement policies and procedures to safeguard the facility and the equipment therein from unauthorized physical access, tampering, and theft.",
      },
      {
        ref: "164.310(a)(2)(iii)",
        name: "Access Control and Validation Procedures",
        required: false,
        description: "Implement procedures to control and validate a person's access to facilities based on their role or function, including visitor control, and control of access to software programs for testing and revision.",
      },
      {
        ref: "164.310(a)(2)(iv)",
        name: "Maintenance Records",
        required: false,
        description: "Implement policies and procedures to document repairs and modifications to the physical components of a facility which are related to security (for example, hardware, walls, doors, and locks).",
      },
    ],
  },
  {
    ref: "164.310(b)",
    standard: "Workstation Use",
    category: "physical",
    required: true,
    description: "Implement policies and procedures that specify the proper functions to be performed, the manner in which those functions are to be performed, and the physical attributes of the surroundings of a specific workstation or class of workstation that can access electronic protected health information.",
    specifications: [],
  },
  {
    ref: "164.310(c)",
    standard: "Workstation Security",
    category: "physical",
    required: true,
    description: "Implement physical safeguards for all workstations that access electronic protected health information, to restrict access to authorized users.",
    specifications: [],
  },
  {
    ref: "164.310(d)(1)",
    standard: "Device and Media Controls",
    category: "physical",
    required: true,
    description: "Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain electronic protected health information into and out of a facility, and the movement of these items within the facility.",
    specifications: [
      {
        ref: "164.310(d)(2)(i)",
        name: "Disposal",
        required: true,
        description: "Implement policies and procedures to address the final disposition of electronic protected health information, and/or the hardware or electronic media on which it is stored.",
      },
      {
        ref: "164.310(d)(2)(ii)",
        name: "Media Re-use",
        required: true,
        description: "Implement procedures for removal of electronic protected health information from electronic media before the media are made available for re-use.",
      },
      {
        ref: "164.310(d)(2)(iii)",
        name: "Accountability",
        required: false,
        description: "Maintain a record of the movements of hardware and electronic media and any person responsible therefore.",
      },
      {
        ref: "164.310(d)(2)(iv)",
        name: "Data Backup and Storage",
        required: false,
        description: "Create a retrievable, exact copy of electronic protected health information, when needed, before movement of equipment.",
      },
    ],
  },

  // ── Technical Safeguards (§164.312) ──

  {
    ref: "164.312(a)(1)",
    standard: "Access Control",
    category: "technical",
    required: true,
    description: "Implement technical policies and procedures for electronic information systems that maintain electronic protected health information to allow access only to those persons or software programs that have been granted access rights as specified in §164.308(a)(4).",
    specifications: [
      {
        ref: "164.312(a)(2)(i)",
        name: "Unique User Identification",
        required: true,
        description: "Assign a unique name and/or number for identifying and tracking user identity.",
      },
      {
        ref: "164.312(a)(2)(ii)",
        name: "Emergency Access Procedure",
        required: true,
        description: "Establish (and implement as needed) procedures for obtaining necessary electronic protected health information during an emergency.",
      },
      {
        ref: "164.312(a)(2)(iii)",
        name: "Automatic Logoff",
        required: false,
        description: "Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.",
      },
      {
        ref: "164.312(a)(2)(iv)",
        name: "Encryption and Decryption",
        required: false,
        description: "Implement a mechanism to encrypt and decrypt electronic protected health information.",
      },
    ],
  },
  {
    ref: "164.312(b)",
    standard: "Audit Controls",
    category: "technical",
    required: true,
    description: "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information.",
    specifications: [],
  },
  {
    ref: "164.312(c)(1)",
    standard: "Integrity",
    category: "technical",
    required: true,
    description: "Implement policies and procedures to protect electronic protected health information from improper alteration or destruction.",
    specifications: [
      {
        ref: "164.312(c)(2)",
        name: "Mechanism to Authenticate Electronic PHI",
        required: false,
        description: "Implement electronic mechanisms to corroborate that electronic protected health information has not been altered or destroyed in an unauthorized manner.",
      },
    ],
  },
  {
    ref: "164.312(d)",
    standard: "Person or Entity Authentication",
    category: "technical",
    required: true,
    description: "Implement procedures to verify that a person or entity seeking access to electronic protected health information is the one claimed.",
    specifications: [],
  },
  {
    ref: "164.312(e)(1)",
    standard: "Transmission Security",
    category: "technical",
    required: true,
    description: "Implement technical security measures to guard against unauthorized access to electronic protected health information that is being transmitted over an electronic communications network.",
    specifications: [
      {
        ref: "164.312(e)(2)(i)",
        name: "Integrity Controls",
        required: false,
        description: "Implement security measures to ensure that electronically transmitted electronic protected health information is not improperly modified without detection until disposed of.",
      },
      {
        ref: "164.312(e)(2)(ii)",
        name: "Encryption",
        required: false,
        description: "Implement a mechanism to encrypt electronic protected health information whenever deemed appropriate.",
      },
    ],
  },
];

/** Flatten all controls + specifications into individual assessment items */
export function flattenControls(): Array<{
  ref: string;
  name: string;
  category: "administrative" | "physical" | "technical";
  parentRef?: string;
  required: boolean;
  description: string;
}> {
  const items: Array<{
    ref: string;
    name: string;
    category: "administrative" | "physical" | "technical";
    parentRef?: string;
    required: boolean;
    description: string;
  }> = [];

  for (const control of HIPAA_SECURITY_CONTROLS) {
    // Add the standard itself
    items.push({
      ref: control.ref,
      name: control.standard,
      category: control.category,
      required: control.required,
      description: control.description,
    });

    // Add implementation specifications
    for (const spec of control.specifications) {
      items.push({
        ref: spec.ref,
        name: spec.name,
        category: control.category,
        parentRef: control.ref,
        required: spec.required,
        description: spec.description,
      });
    }
  }

  return items;
}
