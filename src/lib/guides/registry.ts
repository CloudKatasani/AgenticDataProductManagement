import { STAGES } from '@/lib/lifecycle/stages'
import { ROLES, type RoleKey } from '@/lib/domain/roles'

/**
 * The teaching layer, held as data so it renders inline in the Lifecycle Studio and browses
 * standalone in the Academy. Tone rule: define every technical term at first use, lead with plain
 * language, never assume the reader knows what a semantic layer is.
 */

export interface StageGuide {
  key: string
  stageNumber: number
  title: string
  /** Three sentences, plain language. */
  why: string
  /** An analogy a non-technical stakeholder will understand. */
  plainTerms: string
  /** The concrete downstream failure. This is the persuasive content. */
  whatBreaks: string
  whoIsInvolved: { role: RoleKey; contributes: string }[]
  whatGoodLooksLike: string[]
  commonMistakes: string[]
  glossary: { term: string; definition: string }[]
  effort: string
}

export const STAGE_GUIDES: StageGuide[] = [
  {
    key: 'stage-1',
    stageNumber: 1,
    title: 'Consumption Discovery',
    why: 'This stage names the person who is blocked and the decision they cannot make. It records the questions they would ask if the data existed. Everything downstream is judged against those questions.',
    plainTerms:
      'Before an architect draws a building, someone says who will live in it and what they need to do there. This is that conversation, written down.',
    whatBreaks:
      'Skip it and you get a technically correct dataset that answers nobody\'s question. Six months later the team is asked to justify the spend and can only point at row counts.',
    whoIsInvolved: [
      { role: 'DOMAIN_PRODUCT_OWNER', contributes: 'Owns the record and decides whether the decision is worth unblocking.' },
      { role: 'DOMAIN_SME', contributes: 'Confirms the decision is real and the questions are the ones actually asked.' },
      { role: 'DATA_CONSUMER', contributes: 'Is the source of truth about their own workaround and its cost.' },
    ],
    whatGoodLooksLike: [
      'A named role, not "the business".',
      'A decision phrased as a choice, not as a report request.',
      'At least three questions specific enough that you could argue about the answer.',
      'The current workaround and how long it takes, because that is your baseline.',
    ],
    commonMistakes: [
      'Writing "improve visibility" as the decision.',
      'Listing questions that are really column names.',
      'Recording the requesting manager instead of the person actually blocked.',
    ],
    glossary: [
      { term: 'Decision record', definition: 'One consumer, one recurring decision, and the questions behind it.' },
      { term: 'Latency tolerance', definition: 'How stale the data can be before the decision degrades.' },
    ],
    effort: 'Half a day to two days, mostly interview time',
  },
  {
    key: 'stage-2',
    stageNumber: 2,
    title: 'Charter & Value Case',
    why: 'The charter fixes the boundary of the product, including what it will deliberately not do. The value case commits to a measurable hypothesis. The measurement date creates a task at Stage 12 that will not quietly disappear.',
    plainTerms:
      'A charter is the scope line on a building plan, and the value case is the business case that justified planning permission. Both get checked at the end.',
    whatBreaks:
      'Without an out-of-scope list, the product grows until it satisfies nobody. Without a measurement date, nobody ever finds out whether it was worth building, so the next ten are approved on faith.',
    whoIsInvolved: [
      { role: 'DOMAIN_PRODUCT_OWNER', contributes: 'Writes the charter and owns the hypothesis; holds a veto here.' },
      { role: 'GOVERNANCE_COUNCIL', contributes: 'Tests whether the value case is honest and measurable.' },
      { role: 'PORTFOLIO_LEAD', contributes: 'Uses the value case for prioritisation and later for realisation.' },
    ],
    whatGoodLooksLike: [
      'An explicit out-of-scope list with at least the tempting adjacent things.',
      'A baseline number, an expected change, a method and a date.',
      'Target consumption patterns chosen from the registry, not invented.',
    ],
    commonMistakes: [
      'A hypothesis phrased as "improve decision making".',
      'A measurement method that requires data the product will not produce.',
      'Choosing every consumption pattern to keep options open.',
    ],
    glossary: [
      { term: 'Archetype', definition: 'The kind of product this is — entity master, event stream, metric, feature store, reference data or insight.' },
      { term: 'Value hypothesis', definition: 'A falsifiable claim about what will change, by how much, measured how, by when.' },
    ],
    effort: 'One to three days',
  },
  {
    key: 'stage-3',
    stageNumber: 3,
    title: 'Source Discovery & Profiling',
    why: 'This stage finds the candidate sources, designates the system of record, and looks at the data as it actually is rather than as documented. The gap log records what the sources cannot answer.',
    plainTerms:
      'It is the survey before the build. You may have been told the ground is solid; profiling is where you dig a hole and check.',
    whatBreaks:
      'Most delivery failures are visible here and denied until Stage 8. "The field is always populated" becomes "the field is null 12% of the time", and finding that out after the model is built costs a rebuild.',
    whoIsInvolved: [
      { role: 'DATA_ARCHITECT', contributes: 'Decides which source is authoritative.' },
      { role: 'DATA_STEWARD', contributes: 'Interprets what the anomalies mean in business terms.' },
      { role: 'DATA_ENGINEER', contributes: 'Produces the profile, from a CSV upload if no warehouse connection exists.' },
    ],
    whatGoodLooksLike: [
      'Exactly one system of record, argued for rather than assumed.',
      'Profile statistics for every inventoried source.',
      'Severe gaps with a named owner and a mitigation.',
    ],
    commonMistakes: [
      'Designating two systems of record because both teams objected.',
      'Profiling only the columns you already planned to use.',
      'Recording a gap with no owner, which means nobody.',
    ],
    glossary: [
      { term: 'System of record', definition: 'The one source that wins when two disagree.' },
      { term: 'Null rate', definition: 'The share of rows where a value is missing.' },
      { term: 'Cardinality', definition: 'How many distinct values a column contains.' },
    ],
    effort: 'Two to five days',
  },
  {
    key: 'stage-4',
    stageNumber: 4,
    title: 'Conceptual & Logical Model',
    why: 'This stage states what one row means, what the entities are, and how identity is resolved when two records might be the same thing. It binds to the pack conformed backbone so this product composes with others.',
    plainTerms:
      'The grain statement is the sentence "one row is one customer per month". It sounds trivial until two dashboards disagree and nobody can say which one is wrong.',
    whatBreaks:
      'An unstated grain is the single most common cause of two reports producing different numbers. The argument then happens in front of an executive instead of here.',
    whoIsInvolved: [
      { role: 'DATA_ARCHITECT', contributes: 'Owns the model and holds a veto.' },
      { role: 'DOMAIN_SME', contributes: 'Confirms the entities match how the business actually works.' },
    ],
    whatGoodLooksLike: [
      'A grain statement you could read aloud in a meeting.',
      'Every entity with a primary key.',
      'Identity resolution declared as deterministic, probabilistic or hybrid, with a written justification.',
      'At least one binding to the conformed backbone.',
    ],
    commonMistakes: [
      'Copying the source schema and calling it a model.',
      'Choosing probabilistic matching without saying what a false match would cost.',
      'Leaving the grain implicit because "everyone knows".',
    ],
    glossary: [
      { term: 'Grain', definition: 'What exactly one row represents.' },
      { term: 'Conformed backbone', definition: 'The shared entities every product in a workspace binds to.' },
      { term: 'Identity resolution', definition: 'Deciding whether two records describe the same real-world thing.' },
    ],
    effort: 'Three to eight days',
  },
  {
    key: 'stage-5',
    stageNumber: 5,
    title: 'Attribute Register & Data Contract',
    why: 'Every attribute gets a business definition, a lineage, a datatype and a sensitivity classification. Those definitions become a contract with SLAs, versioning and a deprecation policy. This is the workhorse stage.',
    plainTerms:
      'It is the specification sheet plus the warranty. The register says what each part is; the contract says what you can rely on and what happens when it changes.',
    whatBreaks:
      'An attribute with no business definition becomes a support ticket every time someone new joins. An attribute with no sensitivity classification becomes a breach.',
    whoIsInvolved: [
      { role: 'DATA_STEWARD', contributes: 'Owns definitions and classification; holds a veto.' },
      { role: 'DOMAIN_SME', contributes: 'Confirms each definition matches business reality.' },
      { role: 'DOMAIN_PRODUCT_OWNER', contributes: 'Accepts the SLAs the product is committing to.' },
    ],
    whatGoodLooksLike: [
      'Definitions a new joiner could act on without asking anyone.',
      'Lineage down to source system and column.',
      'Contract columns that all exist in the register.',
      'SLAs the delivery team has actually agreed to meet.',
    ],
    commonMistakes: [
      'Definitions that restate the column name.',
      'Reviewing 200 attributes in a web form instead of exporting to Excel.',
      'Promising freshness nobody checked with the engineers.',
    ],
    glossary: [
      { term: 'Data contract', definition: 'The promise a product makes about schema, freshness, quality and change.' },
      { term: 'Sensitivity classification', definition: 'How restricted an attribute is: public, internal, confidential or restricted.' },
    ],
    effort: 'One to three weeks for a substantial product',
  },
  {
    key: 'stage-6',
    stageNumber: 6,
    title: 'Semantic Model & Metrics',
    why: 'Metrics are defined once here and enforced everywhere. Every metric must trace to a Stage 1 question. Metric names are unique across the workspace so two products cannot mean different things by the same word.',
    plainTerms:
      'This is the dictionary. If "active customer" means one thing in the dashboard and another in the chatbot, the dictionary was never written.',
    whatBreaks:
      'Without it, every channel recomputes its own version of the number and the organisation spends its meetings reconciling instead of deciding.',
    whoIsInvolved: [
      { role: 'SEMANTIC_STEWARD', contributes: 'Owns certified metrics and name uniqueness; holds a veto.' },
      { role: 'DOMAIN_SME', contributes: 'Confirms the metric means what the business thinks it means.' },
    ],
    whatGoodLooksLike: [
      'Every metric traced to a question a named consumer asked.',
      'No metric name that collides with another product in the workspace.',
      'Grain stated on every metric.',
    ],
    commonMistakes: [
      'Certifying a metric because it was easy to compute.',
      'Two products both defining "revenue".',
      'Leaving the grain off, so the same metric sums differently by context.',
    ],
    glossary: [
      { term: 'Semantic layer', definition: 'The single place a metric is defined so every channel returns the same answer.' },
      { term: 'Certified metric', definition: 'A metric a named steward has approved and is accountable for.' },
    ],
    effort: 'Three days to two weeks',
  },
  {
    key: 'stage-7',
    stageNumber: 7,
    title: 'Physical Architecture',
    why: 'Only now does the platform enter the conversation. Attributes are mapped to medallion layers, ingestion and orchestration are chosen, and lineage is generated. The core stays platform-neutral; the pack supplies the vocabulary.',
    plainTerms:
      'You have the plan and the specification; this is choosing the builder and the materials. Doing it first is how you end up with a warehouse full of tables nobody asked for.',
    whatBreaks:
      'Deciding the platform first quietly rewrites the design to suit the tool, and the consumption questions get dropped one by one to fit.',
    whoIsInvolved: [
      { role: 'DATA_ARCHITECT', contributes: 'Owns the physical design; holds a veto.' },
      { role: 'DATA_ENGINEER', contributes: 'Confirms it can actually be built and run on the chosen platform.' },
    ],
    whatGoodLooksLike: [
      'Every registered attribute mapped to bronze, silver or gold.',
      'A populated gold layer — something is genuinely served.',
      'A refresh strategy that matches the freshness the contract promised.',
    ],
    commonMistakes: [
      'Serving consumers directly from silver because gold "was not ready".',
      'A schedule that cannot meet the contract freshness.',
    ],
    glossary: [
      { term: 'Medallion', definition: 'Bronze (raw), silver (conformed), gold (serving) layering of data.' },
      { term: 'Platform profile', definition: 'Pack-supplied vocabulary and templates for a specific platform.' },
    ],
    effort: 'Two days to two weeks',
  },
  {
    key: 'stage-8',
    stageNumber: 8,
    title: 'Quality & Observability',
    why: 'Quality rules are bound to specific attributes across six dimensions, and reconciled against the contract SLAs. Alert routing and a remediation runbook say what happens when a rule breaks.',
    plainTerms:
      'It is the smoke alarm and the fire drill. An alarm nobody has wired to a person is decoration.',
    whatBreaks:
      'A contract promising 30-minute freshness with a monitor that checks daily is a promise nobody is keeping, and the consumer finds out before you do.',
    whoIsInvolved: [
      { role: 'DATA_STEWARD', contributes: 'Owns the rules and thresholds; holds a veto.' },
      { role: 'DATA_ENGINEER', contributes: 'Owns the alert routing and the runbook.' },
    ],
    whatGoodLooksLike: [
      'Every rule bound to a real attribute.',
      'Thresholds at least as strict as the contract.',
      'Freshness and completeness both monitored.',
      'A runbook an on-call engineer can follow at 3am.',
    ],
    commonMistakes: [
      'Rules that monitor the pipeline rather than the data.',
      'Alerts routed to a mailbox nobody reads.',
    ],
    glossary: [
      { term: 'Quality dimension', definition: 'Freshness, completeness, validity, uniqueness, consistency or timeliness.' },
      { term: 'Runbook', definition: 'The written procedure for responding to a specific failure.' },
    ],
    effort: 'Two to five days',
  },
  {
    key: 'stage-9',
    stageNumber: 9,
    title: 'Access & Governance',
    why: 'Every attribute must carry a sensitivity classification before this gate can open. Access is granted by purpose, not by person. Regulatory constraints are mapped to the pack control library, and the Privacy & Security Officer holds a hard veto.',
    plainTerms:
      'This is the point where the product stops being a private project and becomes something other people can see. Somebody has to sign that it is safe.',
    whatBreaks:
      'One unclassified restricted attribute reaching a consumer is a breach, a regulatory event, and the reason the next twelve products get blocked.',
    whoIsInvolved: [
      { role: 'PRIVACY_SECURITY_OFFICER', contributes: 'Signs off classification, policy and regulatory mapping. Hard veto.' },
      { role: 'DOMAIN_PRODUCT_OWNER', contributes: 'Accepts the access model and its operational consequences.' },
    ],
    whatGoodLooksLike: [
      'Zero unclassified attributes.',
      'Masking on every PII or restricted attribute.',
      'Controls cited from the pack library rather than invented.',
      'Retention period, legal basis and residency all stated.',
    ],
    commonMistakes: [
      'Classifying at table level instead of attribute level.',
      'Granting access to a team rather than to a purpose.',
      'Assuming consent rather than checking it.',
    ],
    glossary: [
      { term: 'ABAC', definition: 'Attribute-based access control — access decided by attributes of the user, data and purpose.' },
      { term: 'Purpose limitation', definition: 'Data may be used only for the purpose it was collected and approved for.' },
    ],
    effort: 'Three days to two weeks, longer if legal review is needed',
  },
  {
    key: 'stage-10',
    stageNumber: 10,
    title: 'Serving & Consumption',
    why: 'The product becomes reachable: a BI binding, an API specification, a marketplace listing and a grounding pack. The grounding pack is what makes the product safely usable by a language model, and the validator rejects any reference to a raw table.',
    plainTerms:
      'You have built the thing. This is the shopfront, the instructions, and the safety notice for anyone — human or machine — who picks it up.',
    whatBreaks:
      'A grounding pack pointed at raw tables is how a chatbot confidently reports a number no human would sign. A product with no listing is a product nobody finds.',
    whoIsInvolved: [
      { role: 'SEMANTIC_STEWARD', contributes: 'Owns grounding integrity; holds a veto.' },
      { role: 'DOMAIN_PRODUCT_OWNER', contributes: 'Owns the listing and what it promises consumers.' },
    ],
    whatGoodLooksLike: [
      'Grounding referencing only certified semantic objects.',
      'Refusal guidance that tells the model when to say no.',
      'A listing a stranger could judge the product from.',
    ],
    commonMistakes: [
      'Copying sample questions from the marketing deck rather than the decision register.',
      'Omitting refusal guidance, so the agent answers everything.',
      'Free-form text-to-SQL against raw tables. This is never acceptable here.',
    ],
    glossary: [
      { term: 'Grounding pack', definition: 'The artifact that makes a product safely usable by a language model or agent.' },
      { term: 'Refusal guidance', definition: 'Explicit rules for when a model should decline to answer.' },
    ],
    effort: 'Three to seven days',
  },
  {
    key: 'stage-11',
    stageNumber: 11,
    title: 'Certification & Publication',
    why: 'DATSIS+V is scored dimension by dimension against cited evidence — a specific artifact version or a specific approval. The evidence pack collects every version, approval and audit event. Publication happens here.',
    plainTerms:
      'It is the building inspection. The certificate is only worth something because the inspector had to point at the wiring.',
    whatBreaks:
      'Certification without citations is a badge. The first time a sceptic asks "how do you know it is trustworthy", the answer has to be a document, not a colour.',
    whoIsInvolved: [
      { role: 'GOVERNANCE_COUNCIL', contributes: 'Certifies and authorises publication; holds a veto.' },
      { role: 'DOMAIN_PRODUCT_OWNER', contributes: 'Stands behind the product going live.' },
    ],
    whatGoodLooksLike: [
      'All seven dimensions scored with at least one resolving citation each.',
      'Every upstream gate approved and none gone stale.',
      'An evidence pack you would hand to an auditor unedited.',
    ],
    commonMistakes: [
      'Scoring a dimension from memory.',
      'Certifying while an upstream approval is stale.',
    ],
    glossary: [
      { term: 'DATSIS+V', definition: 'Discoverable, Addressable, Trustworthy, Self-describing, Interoperable, Secure, Valuable.' },
      { term: 'Citation', definition: 'A pointer to a specific artifact version or approval that supports a score.' },
    ],
    effort: 'One to three days',
  },
  {
    key: 'stage-12',
    stageNumber: 12,
    title: 'Operate, Evolve & Retire',
    why: 'Usage, feedback and change requests are captured, and the Stage 2 hypothesis is finally measured. Version bumps cascade re-approval to the gates that relied on the changed evidence. Retirement is a workflow, not neglect.',
    plainTerms:
      'This is the only stage that tells you whether any of the previous eleven were worth doing.',
    whatBreaks:
      'Without it, products that never returned value are quietly forgotten rather than visibly retired, and the portfolio grows a long tail nobody will admit to.',
    whoIsInvolved: [
      { role: 'DOMAIN_PRODUCT_OWNER', contributes: 'Measures the hypothesis and owns the decision to evolve or retire.' },
      { role: 'GOVERNANCE_COUNCIL', contributes: 'Holds a veto over retirement.' },
      { role: 'PORTFOLIO_LEAD', contributes: 'Rolls realisation up to the portfolio.' },
    ],
    whatGoodLooksLike: [
      'The measured hypothesis is the same one committed at Stage 2.',
      'Value declared realised, not realised, or not yet measurable — with an ageing clock on the last one.',
      'Zero-consumption products flagged rather than hidden.',
    ],
    commonMistakes: [
      'Measuring a different, more flattering hypothesis.',
      'Leaving "not yet measurable" in place permanently.',
      'Retiring by switching off the pipeline and telling nobody.',
    ],
    glossary: [
      { term: 'Benefit realisation', definition: 'The measured outcome compared against the hypothesis that justified the build.' },
      { term: 'Cascade re-approval', definition: 'Approvals that relied on changed evidence going stale and needing re-approval.' },
    ],
    effort: 'Ongoing, with a measurement point at the Stage 2 date',
  },
]

const GUIDE_BY_KEY = new Map(STAGE_GUIDES.map((g) => [g.key, g]))

export function getGuide(key: string): StageGuide | undefined {
  return GUIDE_BY_KEY.get(key)
}

export function guideForStage(stageNumber: number): StageGuide | undefined {
  return STAGE_GUIDES.find((g) => g.stageNumber === stageNumber)
}

export interface GuidedTour {
  key: string
  title: string
  audience: string
  minutes: number
  steps: { href: string; title: string; instruction: string }[]
}

export const GUIDED_TOURS: GuidedTour[] = [
  {
    key: 'need-data',
    title: 'I need data and do not know where to start',
    audience: 'Any business user',
    minutes: 5,
    steps: [
      { href: '/marketplace', title: 'Search first', instruction: 'Search for the question you are trying to answer. Filter by your domain.' },
      { href: '/marketplace', title: 'Read a listing', instruction: 'Open a product and read the questions it answers and its trust signals. If it fits, request access.' },
      { href: '/request/new', title: 'Ask for one', instruction: 'If nothing fits, describe the decision you cannot make today. Five screens, no jargon.' },
      { href: '/request', title: 'Follow it', instruction: 'Your request has a visible status and a triage target date. You never have to chase it.' },
    ],
  },
  {
    key: 'triage',
    title: 'Triaging requests as a product owner',
    audience: 'Domain Product Owner',
    minutes: 7,
    steps: [
      { href: '/inbox', title: 'Start at your inbox', instruction: 'Requests awaiting triage appear here with their ageing and target date.' },
      { href: '/request', title: 'Read the decision, not the ask', instruction: 'Judge whether a real decision is blocked and whether the questions are answerable.' },
      { href: '/inbox', title: 'Check the near matches', instruction: 'Duplicate detection runs against published products and open requests. Reuse beats rebuilding.' },
      { href: '/products', title: 'Approve into Stage 1', instruction: 'Approving creates a data product with the decision register pre-populated from the intake answers.' },
    ],
  },
  {
    key: 'all-twelve',
    title: 'All twelve stages',
    audience: 'Practitioners',
    minutes: 20,
    steps: STAGE_GUIDES.map((guide) => ({
      href: `/academy/${guide.key}`,
      title: `Stage ${guide.stageNumber}: ${guide.title}`,
      instruction: guide.why,
    })),
  },
  {
    key: 'agents',
    title: 'How the agents work and what they cannot do',
    audience: 'Anyone nervous about AI in governance',
    minutes: 6,
    steps: [
      { href: '/agents', title: 'Read the charters', instruction: 'Every agent declares what it is for, what it may read, and its autonomy ceiling.' },
      { href: '/agents', title: 'Understand L0 to L3', instruction: 'L3 is the ceiling and L3 is read-only monitoring. There is no level that clears a gate.' },
      { href: '/products', title: 'Watch a disposition', instruction: 'Run the Critic on any stage. Its output is a proposal until a human accepts it.' },
      { href: '/agents', title: 'Check the telemetry', instruction: 'Acceptance rate, edit rate, rejection reasons and cost per stage tell you whether the agents help.' },
    ],
  },
  {
    key: 'cdo',
    title: 'Reading the portfolio as a CDO',
    audience: 'Portfolio Lead / CDO',
    minutes: 5,
    steps: [
      { href: '/portfolio', title: 'Pipeline and ageing', instruction: 'What is in flight, at which stage, and what has breached its response target.' },
      { href: '/portfolio', title: 'Prioritisation', instruction: 'WSJF adapted with a reuse multiplier. Scores are advisory and overridable with a recorded reason.' },
      { href: '/portfolio', title: 'Adoption and value', instruction: 'Products with zero consumption for 90 days are flagged, and value is realised, not realised, or not yet measurable.' },
      { href: '/portfolio', title: 'Maturity', instruction: 'Six dimensions, five levels, and three recommended moves each.' },
    ],
  },
]

export interface RoleGuide {
  role: RoleKey
  name: string
  door: string
  youOwn: string
  yourDayLooksLike: string[]
  whereYouVeto: string
}

export function roleGuides(): RoleGuide[] {
  return ROLES.map((role) => {
    const approves = STAGES.filter((s) => s.approverRoles.includes(role.key)).map((s) => s.number)
    const vetoes = STAGES.filter((s) => s.vetoRoles.includes(role.key)).map((s) => s.number)
    return {
      role: role.key,
      name: role.name,
      door: role.door,
      youOwn: role.owns,
      yourDayLooksLike: [
        approves.length
          ? `You approve at stage ${approves.join(', ')}. Those approvals appear in your inbox.`
          : 'You do not approve gates; your contribution is content and context.',
        role.door === 'CONSUMER'
          ? 'You start at the Marketplace and request what does not exist.'
          : role.door === 'LEADERSHIP'
            ? 'You start at the Portfolio and answer what we are building and what it returned.'
            : 'You start at your inbox: approvals, reviews, comments and agent proposals.',
        'Every action you take is recorded against your name in an append-only audit trail.',
      ],
      whereYouVeto: vetoes.length
        ? `You hold a veto at stage ${vetoes.join(', ')} — a rejection there stops the gate regardless of quorum.`
        : 'You hold no veto.',
    }
  })
}

/** The RACI matrix, computed from the stage registry so it can never drift from enforcement. */
export function raciRows() {
  return ROLES.map((role) => ({
    role: role.key,
    name: role.name,
    stages: STAGES.map((stage) => ({
      number: stage.number,
      responsibility: stage.vetoRoles.includes(role.key)
        ? ('VETO' as const)
        : stage.approverRoles.includes(role.key)
          ? ('APPROVES' as const)
          : ('—' as const),
    })),
  }))
}

export const PRIMER_SECTIONS = [
  {
    title: 'What a data product is here',
    body: 'A data product is a governed answer to a question someone actually asked. It has a named consumer, a named owner, a contract, certified metrics, a classification for every attribute, and evidence behind every claim it makes about itself.',
  },
  {
    title: 'Why we start with a decision',
    body: 'Because starting with a source system produces a table, and starting with a blocked decision produces something a person opens on Monday morning. Every metric in this system must trace back to a question a named consumer asked.',
  },
  {
    title: 'What a gate is',
    body: 'A gate is the approval checkpoint between two stages. It names which roles must approve, how many of them, and who can veto. Nothing moves forward without one, and no agent can clear one.',
  },
  {
    title: 'What the agents do',
    body: 'Agents research, profile, draft, cross-check, critique and monitor. They produce proposals a human accepts, edits or rejects. They never approve, commit, publish or satisfy an exit criterion — there is no configuration that changes this.',
  },
  {
    title: 'How trust is demonstrated',
    body: 'Certification scores seven dimensions against cited artifact versions and approvals. If a citation does not resolve, the gate does not open. Trust is demonstrated, not badged.',
  },
  {
    title: 'What happens after launch',
    body: 'Usage, feedback and change requests are captured, and the value hypothesis committed at charter is measured. Products that never returned value stay visible in the portfolio.',
  },
  {
    title: 'What this tool does not do',
    body: 'It does not run pipelines, execute transformations or query a warehouse. It designs, governs and manages data products. Being honest about that boundary is what makes the rest credible.',
  },
]

export function allGlossaryTerms() {
  const seen = new Map<string, string>()
  for (const guide of STAGE_GUIDES) {
    for (const entry of guide.glossary) {
      if (!seen.has(entry.term)) seen.set(entry.term, entry.definition)
    }
  }
  return [...seen.entries()]
    .map(([term, definition]) => ({ term, definition }))
    .sort((a, b) => a.term.localeCompare(b.term))
}
