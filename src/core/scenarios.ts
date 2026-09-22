import type { Scenario } from "./types";

const colors = ["#4a8a78", "#cd8058", "#7e8bb9", "#c2a466", "#9d9d9a"];
function worlds(entries: [string, string, string][]) {
  return entries.map(([id, label, description], i) => ({
    id,
    label,
    description,
    color: colors[i],
  }));
}
export const scenarios: Scenario[] = [
  {
    id: "atlas",
    version: "1",
    name: "The ambiguous cleanup",
    category: "DATA OPERATIONS",
    description: "A harmless sentence. Four very different consequences.",
    request: "Clean up the old Atlas records before the handover.",
    context:
      "Atlas has staging and production records. Cleanup may mean reversible archiving or permanent deletion. The request does not name an environment or a retention requirement. No operation has been authorized or executed by this demo.",
    worlds: worlds([
      [
        "archive_staging",
        "Archive · staging",
        "The user wants staging records reversibly archived.",
      ],
      [
        "delete_staging",
        "Delete · staging",
        "The user wants staging records permanently deleted.",
      ],
      [
        "archive_production",
        "Archive · production",
        "The user wants production records reversibly archived.",
      ],
      [
        "delete_production",
        "Delete · production",
        "The user wants production records permanently deleted.",
      ],
      [
        "other",
        "Outside this model",
        "The intended task is not any of the four listed cleanup operations.",
      ],
    ]),
    actions: [
      {
        id: "archive_staging",
        label: "Archive staging",
        description: "Prepare a reversible staging archive.",
        losses: {
          archive_staging: 0,
          delete_staging: 8,
          archive_production: 25,
          delete_production: 25,
          other: 40,
        },
      },
      {
        id: "delete_staging",
        label: "Delete staging",
        description: "Prepare a permanent staging deletion.",
        losses: {
          archive_staging: 50,
          delete_staging: 0,
          archive_production: 70,
          delete_production: 70,
          other: 80,
        },
      },
      {
        id: "archive_production",
        label: "Archive production",
        description: "Prepare a reversible production archive.",
        losses: {
          archive_staging: 60,
          delete_staging: 60,
          archive_production: 0,
          delete_production: 12,
          other: 80,
        },
      },
      {
        id: "delete_production",
        label: "Delete production",
        description: "Prepare a permanent production deletion.",
        losses: {
          archive_staging: 100,
          delete_staging: 100,
          archive_production: 100,
          delete_production: 0,
          other: 100,
        },
      },
    ],
    questions: [
      {
        id: "environment",
        text: "Which environment should this affect?",
        cost: 1,
        answers: [
          {
            id: "staging",
            label: "Staging only",
            worlds: ["archive_staging", "delete_staging"],
          },
          {
            id: "production",
            label: "Production",
            worlds: ["archive_production", "delete_production"],
          },
          { id: "other", label: "Something else", worlds: ["other"] },
        ],
      },
      {
        id: "retention",
        text: "Should these records be recoverable?",
        cost: 1,
        answers: [
          {
            id: "archive",
            label: "Yes, keep an archive",
            worlds: ["archive_staging", "archive_production"],
          },
          {
            id: "delete",
            label: "No, permanently delete",
            worlds: ["delete_staging", "delete_production"],
          },
          { id: "other", label: "Neither describes it", worlds: ["other"] },
        ],
      },
    ],
    fixture: {
      archive_staging: 0.38,
      delete_staging: 0.3,
      archive_production: 0.2,
      delete_production: 0.08,
      other: 0.04,
    },
    unknownId: "other",
  },
  {
    id: "release",
    version: "1",
    name: "The release request",
    category: "ENGINEERING",
    description: "Does “roll it back” mean the code, or the flag?",
    request: "The new checkout is causing trouble. Roll it back for now.",
    context:
      "The checkout rollout has a feature flag and a deployed code release. Either the staging or production environment could be affected. Reversing a feature flag is less disruptive than rolling back an entire code deployment.",
    worlds: worlds([
      [
        "flag_staging",
        "Flag · staging",
        "Disable the new checkout feature flag in staging.",
      ],
      [
        "code_staging",
        "Code · staging",
        "Roll back the checkout code deployment in staging.",
      ],
      [
        "flag_production",
        "Flag · production",
        "Disable the new checkout feature flag in production.",
      ],
      [
        "code_production",
        "Code · production",
        "Roll back the checkout code deployment in production.",
      ],
      [
        "other",
        "Outside this model",
        "The intended operation is outside the four listed rollback operations.",
      ],
    ]),
    actions: [
      {
        id: "flag_staging",
        label: "Disable staging flag",
        description: "Preview a staging feature-flag change.",
        losses: {
          flag_staging: 0,
          code_staging: 10,
          flag_production: 25,
          code_production: 30,
          other: 40,
        },
      },
      {
        id: "code_staging",
        label: "Roll back staging code",
        description: "Preview a staging deployment rollback.",
        losses: {
          flag_staging: 25,
          code_staging: 0,
          flag_production: 35,
          code_production: 40,
          other: 50,
        },
      },
      {
        id: "flag_production",
        label: "Disable production flag",
        description: "Preview a production feature-flag change.",
        losses: {
          flag_staging: 45,
          code_staging: 45,
          flag_production: 0,
          code_production: 8,
          other: 50,
        },
      },
      {
        id: "code_production",
        label: "Roll back production code",
        description: "Preview a production deployment rollback.",
        losses: {
          flag_staging: 90,
          code_staging: 90,
          flag_production: 65,
          code_production: 0,
          other: 100,
        },
      },
    ],
    questions: [
      {
        id: "environment",
        text: "Where is checkout having trouble?",
        cost: 1,
        answers: [
          {
            id: "staging",
            label: "Staging only",
            worlds: ["flag_staging", "code_staging"],
          },
          {
            id: "production",
            label: "Production",
            worlds: ["flag_production", "code_production"],
          },
          { id: "other", label: "Something else", worlds: ["other"] },
        ],
      },
      {
        id: "scope",
        text: "What should be rolled back?",
        cost: 1,
        answers: [
          {
            id: "flag",
            label: "Just the feature flag",
            worlds: ["flag_staging", "flag_production"],
          },
          {
            id: "code",
            label: "The code deployment",
            worlds: ["code_staging", "code_production"],
          },
          { id: "other", label: "Neither describes it", worlds: ["other"] },
        ],
      },
    ],
    fixture: {
      flag_staging: 0.08,
      code_staging: 0.08,
      flag_production: 0.57,
      code_production: 0.24,
      other: 0.03,
    },
    unknownId: "other",
  },
  {
    id: "sharing",
    version: "1",
    name: "The sharing boundary",
    category: "COLLABORATION",
    description: "“Send the data” leaves the most important part unsaid.",
    request: "Share the customer insights with the team before the review.",
    context:
      "Customer insights can mean an aggregate summary or identifiable raw records. The team may refer to internal colleagues or an external partner. This workbench only recommends a draft; it cannot share any data.",
    worlds: worlds([
      [
        "summary_internal",
        "Summary · internal",
        "Share only aggregate customer insights with internal colleagues.",
      ],
      [
        "raw_internal",
        "Raw data · internal",
        "Share identifiable customer records with internal colleagues.",
      ],
      [
        "summary_external",
        "Summary · external",
        "Share only aggregate customer insights with an external partner.",
      ],
      [
        "raw_external",
        "Raw data · external",
        "Share identifiable customer records with an external partner.",
      ],
      [
        "other",
        "Outside this model",
        "The intended sharing operation is outside the four listed alternatives.",
      ],
    ]),
    actions: [
      {
        id: "summary_internal",
        label: "Draft internal summary",
        description: "Prepare a summary for internal review.",
        losses: {
          summary_internal: 0,
          raw_internal: 6,
          summary_external: 12,
          raw_external: 15,
          other: 30,
        },
      },
      {
        id: "raw_internal",
        label: "Draft internal data export",
        description: "Prepare an internal raw-data export proposal.",
        losses: {
          summary_internal: 55,
          raw_internal: 0,
          summary_external: 65,
          raw_external: 20,
          other: 80,
        },
      },
      {
        id: "summary_external",
        label: "Draft partner summary",
        description: "Prepare a summary for partner review.",
        losses: {
          summary_internal: 30,
          raw_internal: 40,
          summary_external: 0,
          raw_external: 8,
          other: 45,
        },
      },
      {
        id: "raw_external",
        label: "Draft partner data export",
        description: "Prepare a partner data-export proposal.",
        losses: {
          summary_internal: 100,
          raw_internal: 90,
          summary_external: 95,
          raw_external: 0,
          other: 100,
        },
      },
    ],
    questions: [
      {
        id: "audience",
        text: "Who should receive the insights?",
        cost: 1,
        answers: [
          {
            id: "internal",
            label: "Internal colleagues",
            worlds: ["summary_internal", "raw_internal"],
          },
          {
            id: "external",
            label: "External partner",
            worlds: ["summary_external", "raw_external"],
          },
          { id: "other", label: "Someone else", worlds: ["other"] },
        ],
      },
      {
        id: "detail",
        text: "What level of detail should be shared?",
        cost: 1,
        answers: [
          {
            id: "summary",
            label: "Aggregate summary",
            worlds: ["summary_internal", "summary_external"],
          },
          {
            id: "raw",
            label: "Individual records",
            worlds: ["raw_internal", "raw_external"],
          },
          { id: "other", label: "Neither describes it", worlds: ["other"] },
        ],
      },
    ],
    fixture: {
      summary_internal: 0.7,
      raw_internal: 0.08,
      summary_external: 0.16,
      raw_external: 0.03,
      other: 0.03,
    },
    unknownId: "other",
  },
];
export const defaultSettings = {
  riskBudget: 3,
  ambiguity: 0.06,
  questionCost: 1,
};
export function getScenario(id: string): Scenario {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error("Unknown scenario.");
  return scenario;
}
