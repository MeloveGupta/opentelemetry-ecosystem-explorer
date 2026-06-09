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

import { describe, expect, it } from "vitest";

import type { InstrumentationData } from "@/types/javaagent";
import { toJavaAgentResult } from "./java-agent";

function makeInstrumentation(overrides: Partial<InstrumentationData> = {}): InstrumentationData {
  return {
    name: "kafka-client",
    display_name: "Kafka Client",
    description: "Messaging instrumentation for Kafka",
    scope: { name: "kafka" },
    ...overrides,
  };
}

describe("toJavaAgentResult", () => {
  it("maps an instrumentation to a java-agent search result", () => {
    const result = toJavaAgentResult(makeInstrumentation(), "1.2.3");

    expect(result).toMatchObject({
      title: "Kafka Client",
      description: "Messaging instrumentation for Kafka",
      path: "/java-agent/instrumentation/1.2.3/kafka-client",
      type: "item",
      ecosystem: "java-agent",
      version: "1.2.3",
    });
    // The full instrumentation path is indexed as a keyword so path queries match.
    expect(result.keywords).toContain("/java-agent/instrumentation/1.2.3/kafka-client");
  });

  it("omits stability and surfaces no facet for agent-only instrumentations", () => {
    const result = toJavaAgentResult(makeInstrumentation(), "1.2.3");

    expect(result.stability).toBeUndefined();
    expect(result.facets).toEqual([]);
  });

  it("surfaces a standalone-library facet when the instrumentation ships as one", () => {
    const result = toJavaAgentResult(
      makeInstrumentation({ has_standalone_library: true }),
      "1.2.3"
    );

    expect(result.facets).toEqual(["standalone library"]);
  });

  it("falls back to the instrumentation name when display_name is absent", () => {
    const result = toJavaAgentResult(
      makeInstrumentation({ display_name: undefined, name: "jdbc" }),
      "2.0.0"
    );

    expect(result.title).toBe("jdbc");
  });
});
