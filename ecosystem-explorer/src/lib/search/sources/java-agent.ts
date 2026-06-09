/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  loadAllInstrumentations,
  loadVersions as loadJavaAgentVersions,
} from "@/lib/api/javaagent-data";
import type { InstrumentationData } from "@/types/javaagent";
import type { SearchResult, SearchSource } from "../types";

function addSearchTerm(
  terms: Set<string>,
  value: string | number | boolean | null | undefined
): void {
  if (value === null || value === undefined) {
    return;
  }
  const normalizedValue = String(value).trim();
  if (normalizedValue) {
    terms.add(normalizedValue);
  }
}

/** Collects every searchable string off an instrumentation (name, scope, telemetry, …). */
export function getInstrumentationSearchTerms(instrumentation: InstrumentationData): string[] {
  const terms = new Set<string>();

  addSearchTerm(terms, instrumentation.name);
  addSearchTerm(terms, instrumentation.display_name);
  addSearchTerm(terms, instrumentation.description);
  addSearchTerm(terms, instrumentation.library_link);
  addSearchTerm(terms, instrumentation.source_path);
  addSearchTerm(terms, instrumentation.minimum_java_version);
  addSearchTerm(terms, instrumentation.scope.name);
  addSearchTerm(terms, instrumentation.scope.schema_url);

  instrumentation.semantic_conventions?.forEach((value) => addSearchTerm(terms, value));
  instrumentation.features?.forEach((value) => addSearchTerm(terms, value));
  instrumentation.javaagent_target_versions?.forEach((value) => addSearchTerm(terms, value));

  instrumentation.configurations?.forEach((configuration) => {
    addSearchTerm(terms, configuration.name);
    addSearchTerm(terms, configuration.declarative_name);
    addSearchTerm(terms, configuration.description);
    addSearchTerm(terms, configuration.type);
    addSearchTerm(terms, configuration.default);
    configuration.examples?.forEach((value) => addSearchTerm(terms, value));
  });

  instrumentation.telemetry?.forEach((telemetry) => {
    addSearchTerm(terms, telemetry.when);

    telemetry.metrics?.forEach((metric) => {
      addSearchTerm(terms, metric.name);
      addSearchTerm(terms, metric.description);
      addSearchTerm(terms, metric.instrument);
      addSearchTerm(terms, metric.data_type);
      addSearchTerm(terms, metric.unit);

      metric.attributes?.forEach((attribute) => {
        addSearchTerm(terms, attribute.name);
        addSearchTerm(terms, attribute.type);
      });
    });

    telemetry.spans?.forEach((span) => {
      addSearchTerm(terms, span.span_kind);

      span.attributes?.forEach((attribute) => {
        addSearchTerm(terms, attribute.name);
        addSearchTerm(terms, attribute.type);
      });
    });
  });

  return [...terms];
}

/** Maps a Java Agent instrumentation to a search result. Exported for unit tests. */
export function toJavaAgentResult(
  instrumentation: InstrumentationData,
  version: string,
  resultType: SearchResult["type"] = "item"
): SearchResult {
  const title = instrumentation.display_name ?? instrumentation.name;
  return {
    title,
    description: instrumentation.description ?? "OpenTelemetry Java Agent instrumentation",
    path: `/java-agent/instrumentation/${version}/${instrumentation.name}`,
    type: resultType,
    keywords: [
      ...getInstrumentationSearchTerms(instrumentation),
      `/java-agent/instrumentation/${version}/${instrumentation.name}`,
    ],
    ecosystem: "java-agent",
    version,
    // Most instrumentations run via the agent, so an "agent" facet would just
    // repeat the ecosystem pill. The non-obvious signal is whether one also
    // ships as a standalone library (usable without the agent) — surface only
    // that. Stability is omitted: Java Agent doesn't track it per-instrumentation.
    facets: instrumentation.has_standalone_library ? ["standalone library"] : [],
  };
}

async function loadJavaAgentSearchResults(): Promise<SearchResult[]> {
  const versionsIndex = await loadJavaAgentVersions();
  const latestVersion = versionsIndex.versions.find((version) => version.is_latest)?.version;
  if (!latestVersion) return [];

  const instrumentations = await loadAllInstrumentations(latestVersion);
  return instrumentations.map((instrumentation) =>
    toJavaAgentResult(instrumentation, latestVersion)
  );
}

export const javaAgentSearchSource: SearchSource = {
  id: "java-agent",
  load: loadJavaAgentSearchResults,
};
