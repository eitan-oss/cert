/**
 * Week-specific certification rubrics.
 * Each rubric defines criteria and pass/fail logic.
 */

const WEEK_1_RUBRIC = {
  week: "Week 1",
  sales_process: {
    items: [
      "Active listening + sharp follow-up questions",
      "Identifies pain points tied to engineering and business outcomes",
      "Uncovers stakeholders and decision-making process",
      "Avoids premature pitching, focuses on understanding",
      "Establishes credibility and secures next steps with broader group",
    ],
  },
  product_domain: {
    items: [
      "Demonstrates understanding of software development methodologies",
      "Asks intelligent questions about current engineering workflows",
      "Can speak to how Linear differs philosophically (without feature touring)",
      "Understands typical team structures and how Linear might map to them",
      "Identifies relevant integrations based on customer's stack",
    ],
  },
  /**
   * Pass criteria: Min 4/5 Sales Process + min 3/5 Product/Domain
   */
  evaluate(salesChecked, productChecked) {
    const minSales = salesChecked.length >= 4;
    const minProduct = productChecked.length >= 3;
    return {
      passed: minSales && minProduct,
      sales_count: salesChecked.length,
      sales_total: 5,
      product_count: productChecked.length,
      product_total: 5,
    };
  },
};

const WEEK_2_RUBRIC = {
  week: "Week 2",
  maxPerSection: 5,
  totalMax: 30, // 6 sections × 5
  passThreshold: 23, // ~75% of 30
  modalTitle: "Week 2 Cert Score",
  passRequirements: "*Pass requirements:* _Total ≥23/30 (75%) · Min 3/5 on Pitch, Hierarchy, Workflows, Visibility_",
  sections: [
    {
      id: "pitch",
      title: "Pitch",
      criteria: "Strong opening, clear Linear positioning, tailored to all 3 personas",
    },
    {
      id: "hierarchy",
      title: "Hierarchy & Organization",
      criteria: "Workspace → Teams → Issues → Projects → Initiatives structure",
    },
    {
      id: "workflows",
      title: "Workflows",
      criteria: "Personal (Inbox, My Issues, Reviews, Pulse) + team (Settings, Labels, Cycles)",
    },
    {
      id: "visibility",
      title: "Visibility & Reporting",
      criteria: "Custom Views, Dashboards, Insights",
    },
    {
      id: "objection",
      title: "Objection Handling & Business Outcomes",
      criteria: "Confident objection handling, ties features to business value",
    },
    {
      id: "closing",
      title: "Closing & Next Steps",
      criteria: "Completes 30–45 min, identifies champion, secures next steps, pilot planning",
    },
  ],
  minSection1to4: 3, // Pitch, Hierarchy, Workflows, Visibility must each be >= 3
  evaluate(payload) {
    let total = 0;
    const sectionScores = {};

    for (const section of this.sections) {
      const score = payload[section.id] ?? 0;
      sectionScores[section.id] = score;
      total += score;
    }

    const meetsScore = total >= this.passThreshold;
    const meetsSectionMinimums =
      (sectionScores.pitch || 0) >= this.minSection1to4 &&
      (sectionScores.hierarchy || 0) >= this.minSection1to4 &&
      (sectionScores.workflows || 0) >= this.minSection1to4 &&
      (sectionScores.visibility || 0) >= this.minSection1to4;

    const passed = meetsScore && meetsSectionMinimums;

    return {
      passed,
      total,
      sectionScores,
      gates: {
        score: meetsScore,
        sectionMinimums: meetsSectionMinimums,
      },
    };
  },
};

const WEEK_3_RUBRIC = {
  week: "Week 3",
  maxPerSection: 5,
  totalMax: 20, // 4 sections × 5
  passThreshold: 15, // 75% of 20
  modalTitle: "Week 3 Cert Score",
  passRequirements: "*Pass requirements:* _Total ≥15/20 (75%) · Min 3/5 on Pilot Scoping, AI Capabilities, Integration Setup_",
  sections: [
    {
      id: "pilot_scoping",
      title: "Pilot Scoping & Planning",
      criteria: "Clear scope & success criteria, right pilot team, expectations, milestones, Give-Get framework, champion confidence, training plan, rollback plan",
      gradingCriteria: [
        "Guides to clear pilot scope with success criteria",
        "Identifies appropriate pilot team and builds champion confidence",
        "Sets realistic expectations and establishes Give-Get framework",
        "Provides clear training/enablement plan",
        "Addresses rollback plan and risk mitigation",
      ],
    },
    {
      id: "ai_capabilities",
      title: "AI Capabilities & Vision",
      criteria: "Linear AI vision, agent flow demo (Slack/In-App, Triage Intelligence), connects AI to pilot value",
      gradingCriteria: [
        "Articulates Linear's AI vision clearly",
        "Demonstrates or walks through end-to-end agent flow",
        "Connects AI capabilities to pilot value",
      ],
    },
    {
      id: "integration_setup",
      title: "Integration Setup & Configuration",
      criteria: "GitHub setup, Slack + Linear Asks flow, team structure, labels/templates best practices, workspace config",
      gradingCriteria: [
        "Demonstrates or walks through GitHub integration setup",
        "Demonstrates or walks through Slack integration and Linear Asks config",
        "Demonstrates Linear Asks flow clearly",
        "Recommends appropriate team/sub-team structure",
        "Explains label and template best practices",
        "Shows or explains workspace configuration clearly",
      ],
    },
    {
      id: "migration",
      title: "Migration Strategy & Execution",
      criteria: "Import vs sync, three approaches (recommends team-by-team), pitfalls, timeline, next steps & kickoff",
      gradingCriteria: [
        "Correctly explains import vs. sync and recommends sync for pilot",
        "Presents three approaches and recommends team-by-team",
        "Knows specific common pitfalls with examples",
        "Provides detailed migration timeline",
        "Confirms next steps and pilot kickoff",
      ],
    },
  ],
  minSection1to3: 3, // Pilot Scoping, AI Capabilities, Integration Setup must each be >= 3
  evaluate(payload) {
    let total = 0;
    const sectionScores = {};

    for (const section of this.sections) {
      const score = payload[section.id] ?? 0;
      sectionScores[section.id] = score;
      total += score;
    }

    const meetsScore = total >= this.passThreshold;
    const meetsSectionMinimums =
      (sectionScores.pilot_scoping || 0) >= this.minSection1to3 &&
      (sectionScores.ai_capabilities || 0) >= this.minSection1to3 &&
      (sectionScores.integration_setup || 0) >= this.minSection1to3;

    const passed = meetsScore && meetsSectionMinimums;

    return {
      passed,
      total,
      sectionScores,
      gates: {
        score: meetsScore,
        sectionMinimums: meetsSectionMinimums,
      },
    };
  },
};

const WEEK_4_RUBRIC = {
  week: "Week 4",
  maxPerSection: 5,
  totalMax: 15, // 3 sections × 5
  passThreshold: 12, // 75% of 15
  modalTitle: "Week 4 Cert Score",
  passRequirements: "*Pass requirements:* _Total ≥12/15 (75%) · Min 3/5 on all sections_",
  sections: [
    {
      id: "pricing_presentation",
      title: "Pricing Presentation & Business Value",
      gradingCriteria: [
        "Presents pricing clearly and confidently",
        "Explains pricing model and what's included",
        "Demonstrates ROI with pilot metrics and business value",
        "Handles pricing objections without immediately discounting",
      ],
    },
    {
      id: "negotiation",
      title: "Negotiation & Deal Structuring",
      gradingCriteria: [
        "Negotiates professionally with creative solutions",
        "Maintains deal value (doesn't over-discount)",
        "Addresses payment terms and contract structure",
        "Knows when to escalate to deal desk/leadership",
        "Secures next steps and commitment to move forward",
      ],
    },
    {
      id: "expansion",
      title: "Expansion Beyond Engineering",
      gradingCriteria: [
        "Demonstrates Linear Asks flow clearly",
        "Demonstrates Customer Requests flow clearly",
        "Connects both features to expansion beyond engineering",
        "Positions expansion strategy as value-add for Rideshare",
      ],
    },
  ],
  minPerSection: 3, // All sections must be >= 3
  evaluate(payload) {
    let total = 0;
    const sectionScores = {};

    for (const section of this.sections) {
      const score = payload[section.id] ?? 0;
      sectionScores[section.id] = score;
      total += score;
    }

    const meetsScore = total >= this.passThreshold;
    const meetsSectionMinimums = this.sections.every(
      (s) => (sectionScores[s.id] || 0) >= this.minPerSection
    );

    const passed = meetsScore && meetsSectionMinimums;

    return {
      passed,
      total,
      sectionScores,
      gates: {
        score: meetsScore,
        sectionMinimums: meetsSectionMinimums,
      },
    };
  },
};

const RUBRICS = {
  "Week 1": WEEK_1_RUBRIC,
  "Week 2": WEEK_2_RUBRIC,
  "Week 3": WEEK_3_RUBRIC,
  "Week 4": WEEK_4_RUBRIC,
};

function getRubric(week) {
  return RUBRICS[week] || null;
}

module.exports = {
  WEEK_1_RUBRIC,
  WEEK_2_RUBRIC,
  WEEK_3_RUBRIC,
  WEEK_4_RUBRIC,
  RUBRICS,
  getRubric,
};
