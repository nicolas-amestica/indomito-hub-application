export interface AgentUsageMetric {
  period: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  toolUseTokens: number;
  cachedTokens: number;
  totalTokens: number;
  updatedAt?: string;
}

export type FreeTierStatus = 'safe' | 'warning' | 'exceeded';

export interface FreeTierMetric {
  service: string;
  usageType: string;
  unit: string;
  actual: number;
  forecast: number;
  limit: number;
  utilization: number;
  forecastUtilization: number;
  status: FreeTierStatus;
}

export interface OperationalMetrics {
  agent: AgentUsageMetric;
  aws: {
    cost: {
      amount: number;
      currency: string;
      estimated: boolean;
      scope: 'account' | 'project';
      period: string;
    };
    freeTier: FreeTierMetric[];
    safe: number;
    warning: number;
    exceeded: number;
    available: boolean;
    fetchedAt: string;
    stale?: boolean;
    warningText?: string;
  };
}
