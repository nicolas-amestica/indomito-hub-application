import type { AgentKnowledgeEntry, AgentManagedConfig, AgentManagementSnapshot, AgentProgram } from '../interfaces/agent-management.interface';

export function normalizeAgentProgram(program: AgentProgram): AgentProgram {
  const values = program.destinations?.length ? program.destinations : [program.destination];
  const destinations = [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  return { ...program, destination: destinations[0] ?? '', destinations };
}

function normalizeConfig(config: AgentManagedConfig): AgentManagedConfig {
  const knowledge = (config.knowledge ?? []).map((item): AgentKnowledgeEntry => ({ ...item, questionHints: item.questionHints ?? [] }));
  return { ...config, commercialPolicies: config.commercialPolicies ?? [], knowledge, programs: (config.programs ?? []).map(normalizeAgentProgram) };
}

export function normalizeAgentManagementSnapshot(snapshot: AgentManagementSnapshot): AgentManagementSnapshot {
  return {
    ...snapshot,
    draft: { ...snapshot.draft, config: normalizeConfig(snapshot.draft.config) },
    published: snapshot.published ? { ...snapshot.published, config: normalizeConfig(snapshot.published.config) } : null,
    versions: snapshot.versions.map((version) => ({ ...version, config: normalizeConfig(version.config) })),
  };
}
